const {validationResult} = require('express-validator');
const collectionRepository = require('../../repositories/collection_repository');
const nftRepository = require('../../repositories/nft_repository');
const serialRepository = require('../../repositories/serial_repository');
const saleRepository = require('../../repositories/sale_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {addMongooseParam, getHeaders, _errorFormatter, getCollectionCateValueInEnum, checkTimeCurrent} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {COLLECTION_STATUS, NFT_STATUS, COLLECTION_CATE, IPFS_URL, ALT_URL, SERIAL_STATUS} = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {isEmptyObject, validateRouter, getCoinPrice} = require('../../utils/helper');
const BigNumber = require('bignumber.js');
const consts = require('../../utils/consts');
const fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
const marketAddress = process.env.MARKET_CONTRACT_ADDRESS;

module.exports = {
    classname: 'MarketController',
    cancelBuy: async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }
        const nftId = req.query.nft_id;
        const tokenId = req.query.token_id;
        const saleId = req.query.sale_id;
        const buyer = req.query.buyer;
        const seller = req.query.seller;
        const result = await serialRepository.update({nft_id: nftId, token_id: tokenId, seller, buyer}, {buyer: null, status: SERIAL_STATUS.SELLING});
        const nft = await nftRepository.updateUserQuantitySelling(nftId, result.nModified);
        await saleRepository.findOneAndUpdate({_id: saleId}, {buyer: null, sold: 0});
        return handlerSuccess(req, res, result);
    },
    async selectUserSerials(req, res, next) {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }
        const nftId = req.query.nft_id;
        const buyer = req.query.buyer;
        const seller = req.query.seller;
        const amount = parseInt(req.query.amount);
        const saleId = req.query.sale_id;
        // sale 컬렉션에서 판매숫자 차감처리
        const result = await saleRepository.findOneAndUpdate({_id: saleId, sold: 0}, {buyer, sold: amount});
        console.log(result);
        if (result.nModified === 0) {
            return handlerError(req, res, ErrorMessage.ALREADY_BUYING);
        }
        // serials에서 판매중 처리
        const serials = await serialRepository.findUserNftAndUpdate(nftId, buyer, seller, amount);
        console.log('=====', serials);
        if (serials.length > 0) {
            const nft = await nftRepository.updateUserQuantitySelling(nftId, -serials.length);
            return handlerSuccess(req, res, serials);
        }
        else
            return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
    },

    async saleList(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            const page = +req.query.page || 1;
            const size = +req.query.size || 10;
            const count = await saleRepository.count();
            const responseHeaders = getHeaders(count, page, size);

            const sales = await saleRepository.findByNftId(req.params.nftId, page, size);
            const coinPrices = await getCoinPrice();
            const result = sales.map((sale) => {
                const priceUsd = (new BigNumber(sale.price)).multipliedBy(new BigNumber(coinPrices[sale.quote].USD)).toNumber();
                const newSale = {...sale._doc, priceUsd};
                return newSale;
            })
            // console.log(result);
            return handlerSuccess(req, res, {items: result, headers: responseHeaders});
        } catch (e) {
            logger.error(new Error(e));
            console.log(e);
            return handlerError(req, res, ErrorMessage.USER_NFT_SELL_FAIL);
        }
    },
    async sellUserNft(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            const {
                seller,
                quantity,
                price,
                quote,
                collectionId,
                nftId,
                tokenId,
                serialIds
            } = req.body
            // sale collection 에 row 생성
            const newSale = {
                seller,
                quantity,
                price,
                quote,
                collection_id : collectionId,
                nft_id: nftId,
                token_id: tokenId,
            }
            const sale = await saleRepository.createSale(newSale);
            // serials 판매상태로 변경
            if (!sale) {
                return handlerError(req, res, ErrorMessage.USER_NFT_SELL_FAIL);
            }
            // nft의 user_selling_quantity 증가
            await nftRepository.updateUserQuantitySelling(nftId, quantity);

            // serialIds
            await serialRepository.updateByIds(serialIds, {status: SERIAL_STATUS.SELLING, price, quote, seller, owner_id: marketAddress});
            return handlerSuccess(req, res, sale);
        } catch (e) {
            logger.error(new Error(e));
            console.log(e);
            return handlerError(req, res, ErrorMessage.USER_NFT_SELL_FAIL);
        }
    },
    async getAvailableNfts(req, res, next) {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            let findParams = {
                type: 0,
                company_id: req.query.company_id,
                status: NFT_STATUS.ACTIVE,
                collection_id: null,
                // start_date: {$lte: new Date()},
                // end_date: {$gt: new Date()},
                quantity_selling: {$gt: 0},
                selling_status: {$ne: consts.SELLING_STATUS.STOP},
            };

            const count = await nftRepository.count(findParams);

            if (count == 0) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const availableNfts = await nftRepository.findAll(findParams, {
                page: 1,
                perPage: count,
            });

            if (!availableNfts) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: availableNfts,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexCollectionCategories(req, res, next) {
        try {
            validateRouter(req, res);

            const allCategories = COLLECTION_CATE;

            const arrayVal = [];
            for (const property in allCategories) {
                arrayVal.push(allCategories[property]);
            }

            return handlerSuccess(req, res, arrayVal);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    createCollection: async (req, res, next) => {
        // async createCollection(req, res, next) {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            //upload file
            // await collectionUploadRepository(req, res);

            // 커버 이미지 하나로 변경
            // let my_file = req.files.file[0];
            let my_file = req.file;

            //resize
            let imgName = my_file.filename.split('.');
            let imgInput = my_file.filename;
            // do not resize cover
            // let imgOutput = imgName[0] + '_resize.' + imgName[imgName.length - 1];
            // await imageResize('./uploads/cover/' + imgInput, './uploads/cover/' + imgOutput);

            // TODO : Collection의 Thumbnail로 변경
            let cover_image = await nftRepository.addFileToIPFS(my_file);

            let newCollection = {
                network: req.body.network,
                name: req.body.name,
                cover_image: IPFS_URL + cover_image.Hash,
                // cover_image: ALT_URL + my_file.path,
                // company_id: req.body.company_id,
                creator_id: req.body.creator_id,
                contract_address: req.body.contract_address,
                contract_type: req.body.contract_type,
                // path: '/talkenNft/' + consts.NFT_CONTRACT_ADDR + '/cover/'  + imgInput,
                path: '/talkenNft/uploads/collections/' + imgInput,
                // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                // category: JSON.parse(req.body.category)
                ...(req.body?.category && {category: req.body.category}),
                category: req.body.category,
                maximum_supply: req.body.maximum_supply ?? 0,
                description: req.body.description ?? ''
            };
            // let nft_id = JSON.parse(req.body.nft_id);
            //
            // if (nft_id.length > 4) {
            //     return handlerError(req, res, ErrorMessage.COLLECTION_IS_OVERSIZE);
            // }

            // let allNftNotInCollection = true;
            // for (let i = 0; i < req.body.nft_id.length; i++) {
            //     const nft = await nftRepository.findById(req.body.nft_id[i]);
            //     if (!(!(nft?.collection_id) ||
            //         (nft.collection_id === null || '') ||
            //         (nft.company_id === newCollection.company_id))) {
            //             allNftNotInCollection = false;
            //             break;
            //     }
            // }

            // if (allNftNotInCollection) {
            let collection = await collectionRepository.create(newCollection);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.CREATE_COLLECTION_IS_NOT_SUCCESS);
            }
            // for (let i = 0; i < nft_id.length; i++) {
            //     // const nft = await nftRepository.findById(newCollection.nft_id[i]);
            //
            //     // if (!(nft?.collection_id) || (nft.collection_id === null || '')) {
            //     const updateNft = await nftRepository.update(nft_id[i], {
            //         collection_id: collection._id,
            //     });
            //     // }
            // }
            await fs.mkdir(`./uploads/${req.body.contract_address}/thumbnail`, { recursive: true }, (err) => {
                if (err) throw err;
            });
            return handlerSuccess(req, res, collection);
            // } else {
            //     return handlerError(req, res, ErrorMessage.NFT_ALREADY_IN_COLLECTION);
            // }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexCollections(req, res, next) {
        try {
            validateRouter(req, res);
            const findParams = await getFindParams(req.query);

            let page = +req.query.page || 1;
            let perPage;
            if (req.query.perPage) {
                perPage = +req.query.perPage || 20;
            }

            const count = await collectionRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const collections = await collectionRepository.findOnSale(findParams);
            if (!collections) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            let collectionsResp = [];
            for (let i = 0; i < collections.length; i++) {
                 const nfts = await nftRepository.findAllNftsByCollectionId(collections[i]._id);
                 if (nfts) {
                     const products = convertProductResponse(nfts);
                     const selling = products.filter((prod) => prod.selling === true);
                     if (selling.length) {
                         collectionsResp.push(collections[i]);
                     }
                 }
            };

            const start = (+req.query.page - 1) * +req.query.perPage;
            let end = +start + +req.query.perPage;
            if (end > collectionsResp.length) end = collectionsResp.length;
            console.log('===>', start, end)
            return handlerSuccess(req, res, {
                items: collectionsResp.slice(start, end),
                selling: [],
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexCollectionsR(req, res, next) {
        try {
            validateRouter(req, res);
            const findParams = await getFindParams(req.query);
            const count = req.query.count ? req.query.count : 1;

            const collections = await collectionRepository.findAll(findParams, {page: null, perPage: null});
            if (!collections) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            let collectionsResp = [];
            for (let i = 0; i < collections.length; i++) {
                const nfts = await nftRepository.findAllNftsByCollectionId(collections[i]._id);
                if (nfts) {
                    const products = convertProductResponse(nfts);
                    const selling = products.filter((prod) => prod.selling === true);
                    if (selling.length) {
                        collectionsResp.push(collections[i]);
                    }
                }
            };

            return handlerSuccess(req, res, {
                items: collectionsResp.sort(() => Math.random() - Math.random()).slice(0, count),
                selling: []
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getMyCollections(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            validateRouter(req, res);
            let collections = await collectionRepository.findByCreatorId(req.params.id);

            let result = JSON.parse(JSON.stringify(collections));

            return handlerSuccess(req, res, result);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getDetailCollection(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            validateRouter(req, res);
            let collection = await collectionRepository.findById(req.params.id);

            const nfts = await nftRepository.findAllNftsByCollectionId(req.params.id);

            let result = JSON.parse(JSON.stringify(collection));
            result.nft = nfts;

            return handlerSuccess(req, res, result);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateCollection(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var inputBody = {
                name: req.body.name,
                ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                ...(req.body?.nft_id && {nft_id: JSON.parse(req.body.nft_id)}),
            };

            const data = getUpdateBodys(inputBody);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            if (data.nft_id) {
                if (data.nft_id.length > 4) {
                    return handlerError(req, res, ErrorMessage.COLLECTION_IS_OVERSIZE);
                }

                const oldNfts = await nftRepository.findAllNftsByCollectionId(req.params.id);

                for (let i = 0; i < oldNfts.length; i++) {
                    if (!data.nft_id.includes(oldNfts[i]._id)) {
                        const updateNft = await nftRepository.update(oldNfts[i]._id, {
                            collection_id: null,
                        });
                    }
                }

                if (data.nft_id.length == 0) {
                    const updateCollection = await collectionRepository.updateById(req.params.id, {
                        status: consts.COLLECTION_STATUS.SUSPEND,
                    });
                    if (!updateCollection) {
                        return handlerError(
                            req,
                            res,
                            ErrorMessage.UPDATE_COLLECTION_IS_NOT_SUCCESS,
                        );
                    }

                    return handlerSuccess(req, res, updateCollection);
                }

                for (let i = 0; i < data.nft_id.length; i++) {
                    const updateNft = await nftRepository.update(data.nft_id[i], {
                        collection_id: req.params.id,
                    });
                }
            }

            const updateCollection = await collectionRepository.updateById(req.params.id, data);
            if (!updateCollection) {
                return handlerError(req, res, ErrorMessage.UPDATE_COLLECTION_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateCollection);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateCollectionStatus(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var inputBody = {
                status: req.body.status,
            };

            const data = getUpdateBodys(inputBody);

            const updateCollection = await collectionRepository.updateById(req.params.id, data);
            if (!updateCollection) {
                return handlerError(req, res, ErrorMessage.UPDATE_COLLECTION_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateCollection);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteCollection(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            let collection = await collectionRepository.findById(req.params.id);

            if (collection.status === COLLECTION_STATUS.ACTIVE) {
                const deleteCollection = await collectionRepository.updateById(req.params.id, {
                    status: COLLECTION_STATUS.SUSPEND,
                });

                const nfts = await nftRepository.findAllNftsByCollectionId(req.params.id);

                for (let i = 0; i < nfts.length; i++) {
                    const updateNft = await nftRepository.update(nfts[i]._id, {
                        collection_id: null,
                    });
                }

                return handlerSuccess(req, res, deleteCollection);
            } else {
                return handlerError(req, res, ErrorMessage.DELETE_COLLECTION_IS_NOT_SUCCESS);
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteCollections(req, res, next) {
        try {
            // if (ObjectID.isValid(req.params.id) === false) {
            //     return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            // }

            const ids = req.body.ids;
            for (let i = 0; i < ids.length; i++) {
                let collection = await collectionRepository.findById(ids[i]);

                if (collection.status === COLLECTION_STATUS.ACTIVE) {
                    await collectionRepository.updateById(ids[i], {
                        status: COLLECTION_STATUS.SUSPEND,
                    });

                    const nfts = await nftRepository.findAllNftsByCollectionId(ids[i]);

                    for (let i = 0; i < nfts.length; i++) {
                        const updateNft = await nftRepository.update(nfts[i]._id, {
                            collection_id: null,
                        });
                    }
                } else {
                    return handlerError(req, res, ErrorMessage.DELETE_COLLECTION_IS_NOT_SUCCESS);
                }
            };

            return handlerSuccess(req, res, 'Delete collections success');
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async addNftToCollection(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const oldNfts = await nftRepository.findAllNftsByCollectionId(req.params.id);

            let newNftIds = req.body.nft_id;

            if (oldNfts.length > 4 || oldNfts.length + newNftIds.length > 4) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_OVERSIZE);
            }

            for (let i = 0; i < newNftIds.length; i++) {
                const updateNft = await nftRepository.update(newNftIds[i], {
                    collection_id: req.params.id,
                });
            }

            let collection = await collectionRepository.findById(req.params.id);

            const nfts = await nftRepository.findAllNftsByCollectionId(req.params.id);

            let result = JSON.parse(JSON.stringify(collection));
            result.nft = nfts;

            return handlerSuccess(req, res, result);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async removeNftFromCollection(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            let removeNftIds = req.body.nft_id;

            for (let i = 0; i < removeNftIds.length; i++) {
                const updateNft = await nftRepository.update(removeNftIds[i], {
                    collection_id: null,
                });
            }

            let collection = await collectionRepository.findById(req.params.id);

            const nfts = await nftRepository.findAllNftsByCollectionId(req.params.id);

            if (nfts.length === 0) {
                const deleteCollection = await collectionRepository.updateById(req.params.id, {
                    status: COLLECTION_STATUS.SUSPEND,
                });
                return handlerSuccess(req, res, deleteCollection);
            } else {
                let result = JSON.parse(JSON.stringify(collection));
                result.nft = nfts;

                return handlerSuccess(req, res, result);
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

async function getFindParams(filters) {
    let findParams = {};

    if (filters.category) {
        findParams.category = filters.category;
    }

    if (!filters.status) {
        findParams.status = COLLECTION_STATUS.ACTIVE;
    } else {
        findParams.status = filters.status;
    }

    if (filters.creator_id) {
        findParams.creator_id = filters.creator_id;
    }

    // const findByCompanyName = Object.assign({}, findParams);
    const findByCreatorName = Object.assign({}, findParams);

    if (filters.keyword) {
        // const companyIds = await collectionRepository.findByCompanyName(filters.keyword);
        //
        // if (companyIds && companyIds.length > 0) {
        //     findByCompanyName.company_id = companyIds;
        // }
        const creatorIds = await collectionRepository.findByCreatorName(filters.keyword);

        if (creatorIds && creatorIds.length > 0) {
            findByCreatorName.creator_id = creatorIds;
        }
    }

    const findByName = Object.assign({}, findParams);
    // const findByCompanyId = Object.assign({}, findParams);
    const findByCreatorId = Object.assign({}, findParams);

    if (filters.keyword) {
        findByName.name = addMongooseParam(
            findByName.name,
            '$regex',
            new RegExp(filters.keyword, 'i'),
        );

        if (ObjectID.isValid(filters.keyword) === true) {
            // findByCompanyId.company_id = addMongooseParam(
            //     findByCompanyId.company_id,
            //     '$eq',
            //     filters.keyword,
            // );
            findByCreatorId.creator_id = addMongooseParam(
                findByCreatorId.creator_id,
                '$eq',
                filters.keyword,
            );
        }
    }

    const searchParams = {
        $or: [findByName],
    };

    if (ObjectID.isValid(filters.keyword) === true) {
        // searchParams['$or'].push(findByCompanyId);
        searchParams['$or'].push(findByCreatorId);
    }

    // if (typeof findByCompanyName.company_id !== 'undefined') {
    if (typeof findByCreatorName.creator_id !== 'undefined') {
        // searchParams['$or'].push(findByCompanyName);
        searchParams['$or'].push(findByCreatorName);
    }

    // console.log(searchParams['$or']);
    return searchParams;
}

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates.name) {
        updateBodys.name = updates.name;
    }

    if (updates.category) {
        updateBodys.category = updates.category;
    }

    if (updates.nft_id) {
        updateBodys.nft_id = updates.nft_id;
    }

    if (updates.status) {
        updateBodys.status = updates.status;
    }

    if (!isEmptyObject(updateBodys)) {
        updateBodys.updatedAt = Date.now();
    }

    return updateBodys;
}

function convertProductResponse(products) {
    const current_time = new Date();
    const productsRes = [];
    products.forEach((element) => {
        let item = Object.assign({}, element._doc);
        if (element.quantity_selling > 0) {
            if (element.selling_status === consts.SELLING_STATUS.SELL) {
                if (checkTimeCurrent(element.start_date, current_time, element.end_date) === true) {
                    productsRes.push({
                        ...item,
                        selling: true,
                    });
                }

                if (
                    checkTimeCurrent(element.start_date, current_time, element.end_date) === false
                ) {
                    productsRes.push({
                        ...item,
                        selling: false,
                    });
                }
            }
            if (element.selling_status === consts.SELLING_STATUS.STOP) {
                productsRes.push({
                    ...item,
                    selling: false,
                });
            }
        } else {
            productsRes.push({
                ...item,
                selling: false,
            });
        }
    });

    return productsRes;
}