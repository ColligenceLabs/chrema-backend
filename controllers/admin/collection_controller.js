const {validationResult} = require('express-validator');
const collectionRepository = require('../../repositories/collection_repository');
const nftRepository = require('../../repositories/nft_repository');
const serialRepository = require('../../repositories/serial_repository');
const tradeRepository = require('../../repositories/trade_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {addMongooseParam, getHeaders, _errorFormatter, getCollectionCateValueInEnum} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {COLLECTION_STATUS, NFT_STATUS, COLLECTION_CATE, IPFS_URL, ALT_URL} = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {isEmptyObject, validateRouter, getCoinPrice, getFloorPrice} = require('../../utils/helper');
const consts = require('../../utils/consts');
const fs = require('fs');
const ObjectID = require('mongodb').ObjectID;
const {_getAllTokens, _getAllTokensWeb3, _getTokenInfo} = require('../blockchain/nft_controller');

module.exports = {
    classname: 'CollectionController',

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

            if (req.body.contract_address === undefined || req.body.contract_address === '') {
                return handlerError(req, res, 'No smart contract address');
            }

            // if (req.body.typed_contract === 'true') {
                // 이미 등록된 contractAddress 인지 확인 필요.
                // const contractAddress = '0xb9eda5c4bd2dfe83b9ea3b57e62fdadec2c18598';  // 이미 등록된 contractAddress
                // const contractAddress = '0x464b60257a0e6c77b1cc2515c86593daa83e665e';     // 등록되지 않은 kaikas를 통해 생성된 contractAddress
                const contractAddress = req.body.contract_address;
                // collection 에서 해당 contract_address 로 조회 중복 체크
                const col = await collectionRepository.findByContractAddress(contractAddress);
                if (col) {
                    return handlerError(req, res, ErrorMessage.COLLECTION_ALREADY_EXIST);
                }
            // }
            //upload file
            // await collectionUploadRepository(req, res);

            // 커버 이미지 하나로 변경
            // let my_file = req.files.file[0];
            let my_file = req.files.image[0];

            //resize
            let imgName = my_file.filename.split('.');
            let imgInput = my_file.filename;
            // do not resize cover
            // let imgOutput = imgName[0] + '_resize.' + imgName[imgName.length - 1];
            // await imageResize('./uploads/cover/' + imgInput, './uploads/cover/' + imgOutput);
            let logo_image;
            if (req.files?.logo) {
                logo_image = ALT_URL + 'collections/' + req.files.logo[0].filename;
            }
            // TODO : Collection의 Thumbnail로 변경
            let cover_image = await nftRepository.addFileToIPFS(my_file);

            let newCollection = {
                network: req.body.network,
                name: req.body.name,
                cover_image: IPFS_URL + cover_image.Hash,
                logo_image: logo_image,
                url: req.body.url,
                // cover_image: ALT_URL + my_file.path,
                // company_id: req.body.company_id,
                creator_id: req.body.creator_id,
                contract_address: req.body.contract_address,
                contract_type: req.body.contract_type,
                // path: '/taalNft/' + consts.NFT_CONTRACT_ADDR + '/cover/'  + imgInput,
                path: process.env.API_PREFIX + '/taalNft/uploads/collections/' + imgInput,
                image_link: ALT_URL + 'collections/' + imgInput,
                // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                // category: JSON.parse(req.body.category)
                ...(req.body?.category && {category: req.body.category}),
                category: req.body.category,
                maximum_supply: req.body.maximum_supply ?? 0,
                description: req.body.description ?? '',
                directory: req.body.directory ?? '',
                symbol: req.body.symbol ?? '',
                fee_percentage: req.body.fee_percentage ?? 0,
                fee_payout: req.body.fee_payout ?? ''
            };
            // string: http://localhost:4000/taalNft///{id}.json
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
            if (req.body.typed_contract === 'true') {
                const contractAddress = req.body.contract_address.toLowerCase();
                // nft, serials 를 생성한다. 우선 모두 실패처리.
                // 1. kaikas api 로 모튼 nft 조회.
                // 2. kaikas api 로 조회 안될 경우 web3 로 조회
                // 3. 조회된 nft 정보로 nft 생성하고 serials를 total supply 만큼 생성한다.
                let result;
                try {
                    result = await _getAllTokens(contractAddress, req.body.contract_type);
                } catch (e) {
                    console.log(e);
                }
                if (!result) {
                    console.log('kaikas 로 조회 안됨.', req.body);
                    try {
                        result = await _getAllTokensWeb3(contractAddress, 'klaytn', req.body.contract_type);
                    } catch (e) {
                        console.log(e);
                        return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
                    }
                }
                result.sort((a, b) => {
                    return parseInt(a.tokenId) - parseInt(b.tokenId);
                });
                let beforeUri;
                let tokenMeta = {};
                let nft;
                let count;
                const newNFTs = [];
                let data = [];
                for (let i = 0; i < result.length; i++) {
                    if (beforeUri !== result[i].tokenUri) {
                        beforeUri = result[i].tokenUri;
                        if (beforeUri.startsWith('ipfs://')) {
                            beforeUri = beforeUri.replace('ipfs://', 'https://infura-ipfs.io/ipfs/');
                        } else if (beforeUri.startsWith('data:application/json')) {
                            data = beforeUri.split(',');
                        }
                        if (data.length !== 0) {
                            tokenMeta.data = JSON.parse(Buffer.from(data[data.length - 1], 'base64').toString());
                        } else {
                            tokenMeta = await _getTokenInfo(beforeUri.replace('https://ipfs.io', 'https://infura-ipfs.io'));
                        }
                        // nft 생성
                        // const newNFT = getNewNFT(tokenMeta, new ObjectID(collection._id), req.body.creator_id);
                        if (tokenMeta.data.image.startsWith('ipfs://'))
                            tokenMeta.data.image = tokenMeta.data.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
                        console.log(i, tokenMeta.data);
                        const newNFT = getNewNFT(tokenMeta.data, collection._id, req.body.creator_id, collection.category);
                        console.log(newNFT);
                        nft = await nftRepository.createWithoutSerial(newNFT);
                        console.log(nft);
                        count = 1;
                        newNFTs.push(nft._id);
                    }
                    const newSerial = {
                        nft_id: nft._id,
                        index: count++,
                        type: nft.type,
                        token_id: result[i].tokenId,
                        transfered: 1,
                        ipfs_link: beforeUri,
                        contract_address: contractAddress,
                        status: consts.SERIAL_STATUS.ACTIVE,
                    }
                    await serialRepository.createWithOwner(newSerial, result[i].owner);
                }
                console.log(collection._id, newNFTs);
            }

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

            const collections = await collectionRepository.findAllReverse(findParams, {page, perPage});
            if (!collections) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: collections,
                headers: responseHeaders,
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
        let collection;
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            validateRouter(req, res);
            collection = await collectionRepository.findById(req.params.id);

            let result = JSON.parse(JSON.stringify(collection));
            return handlerSuccess(req, res, result);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }

        // try {
        //     const nfts = await nftRepository.findAllNftsByCollectionId(req.params.id);
        //
        //     let result = JSON.parse(JSON.stringify(collection));
        //     result.nft = nfts;
        //
        //     return handlerSuccess(req, res, result);
        // } catch (error) {
        //     logger.error(new Error(error));
        //     next(error);
        // }
    },

    async updateCollection(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var inputBody = {
                name: req.body.name,
                description: req.body.description,
                category: req.body.category,
                // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                // ...(req.body?.nft_id && {nft_id: JSON.parse(req.body.nft_id)}),
            };

            const data = getUpdateBodys(inputBody);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            if (req.file) {
                let my_file = req.file;

                //resize
                let imgName = my_file.filename.split('.');
                let imgInput = my_file.filename;
                // do not resize cover
                // let imgOutput = imgName[0] + '_resize.' + imgName[imgName.length - 1];
                // await imageResize('./uploads/cover/' + imgInput, './uploads/cover/' + imgOutput);

                // TODO : Collection의 Thumbnail로 변경
                let cover_image = await nftRepository.addFileToIPFS(my_file);

                data.cover_image = IPFS_URL + cover_image.Hash;
                data.path = process.env.API_PREFIX + '/taalNft/uploads/collections/' + imgInput;
                data.image_link = ALT_URL + 'collections/' + imgInput;
            }

            // 여기는 왜 있지 ?
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
    async getTopCollections(req, res, next) {
        console.log(req.query.days);
        const days = req.query.days ? req.query.days : '1d';
        const limit = req.query.size ? parseInt(req.query.size) : 10;
        const skip = req.query.page ? parseInt(req.query.page) * limit : 0;
        try {
            const result = await tradeRepository.selectTopCollections(days, limit, skip);
            const collection_ids = result.map((item) => {return item._id});
            const collections = await collectionRepository.findByIds(collection_ids);
            const retCollections = [];
            for (let i = 0; i < result.length; i++) {
                const collection = collections.filter((item) => item._id.toString() === result[i]._id.toString());
                const floorPrices = await serialRepository.findFloorPrice(collection[0].contract_address.toLowerCase());
                const filteredPrices = floorPrices.filter(price => price._id === 'talk' || price._id === 'klay');
                let floorPrice;
                if (filteredPrices.length > 0) {
                    const coinPrices = await getCoinPrice();
                    floorPrice = getFloorPrice(filteredPrices, coinPrices);
                }
                retCollections. push({...collection[0]._doc, ...result[i], floorPrice});
            }
            handlerSuccess(req, res, retCollections);
        } catch (e) {
            logger.error(new Error(e));
            handlerError(req, res, e);
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

    if (updates.description) {
        updateBodys.description = updates.description;
    }

    if (!isEmptyObject(updateBodys)) {
        updateBodys.updatedAt = Date.now();
    }

    return updateBodys;
}

function getNewNFT(tokenMeta, collection_id, creator, category) {
    let newNft = {
        metadata: tokenMeta,
        // company_id: req.body.company_id,
        collection_id,
        creator_id: creator,
        type: 0,
        price: 0,
        quantity: tokenMeta.total_minted,
        quantity_selling: 0,
        onchain: 'true',
        start_date: null,
        end_date: null,
        status: NFT_STATUS.ACTIVE,
        // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
        // ...(req.body?.category && {category: req.body.category}),
        category: category,
        description: tokenMeta.description,
        imported: 'true',
        transfered: 0
    };
    return newNft;
}
