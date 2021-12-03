const {validationResult} = require('express-validator');
const collectionRepository = require('../../repositories/collection_repository');
const nftRepository = require('../../repositories/nft_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {addMongooseParam, getHeaders} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {COLLECTION_STATUS, NFT_STATUS, COLLECTION_CATE, IPFS_URL} = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {isEmptyObject, validateRouter, imageResize} = require('../../utils/helper');
var collectionUploadRepository = require('../../repositories/collection_upload_repository');
const consts = require('../../utils/consts');
var ObjectID = require('mongodb').ObjectID;

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
                end_date: {$gt: new Date()},
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
            await collectionUploadRepository(req, res);

            let my_file = req.files.file[0];

            //resize
            let imgName = my_file.filename.split('.');
            let imgInput = my_file.filename;
            let imgOutput = imgName[0] + '_resize.' + imgName[imgName.length - 1];
            await imageResize('./uploads/cover/' + imgInput, './uploads/cover/' + imgOutput);

            let cover_image = await nftRepository.addFileToIPFS(my_file);

            let newCollection = {
                name: req.body.name,
                cover_image: IPFS_URL + cover_image.Hash,
                company_id: req.body.company_id,
                path: '/talkenNft/cover/' + imgOutput,
                ...(req.body?.category && {category: JSON.parse(req.body.category)}),
            };
            let nft_id = JSON.parse(req.body.nft_id);

            if (nft_id.length > 4) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_OVERSIZE);
            }

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
            for (let i = 0; i < nft_id.length; i++) {
                // const nft = await nftRepository.findById(newCollection.nft_id[i]);

                // if (!(nft?.collection_id) || (nft.collection_id === null || '')) {
                const updateNft = await nftRepository.update(nft_id[i], {
                    collection_id: collection._id,
                });
                // }
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
            let perPage = +req.query.perPage || 20;

            const count = await collectionRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const collections = await collectionRepository.findAll(findParams, {page, perPage});
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
        findParams.status = NFT_STATUS.ACTIVE;
    } else {
        findParams.status = filters.status;
    }

    const findByCompanyName = Object.assign({}, findParams);

    if (filters.keyword) {
        const companyIds = await collectionRepository.findByCompanyName(filters.keyword);

        if (companyIds && companyIds.length > 0) {
            findByCompanyName.company_id = companyIds;
        }
    }

    const findByName = Object.assign({}, findParams);
    const findByCompanyId = Object.assign({}, findParams);

    if (filters.keyword) {
        findByName.name = addMongooseParam(
            findByName.name,
            '$regex',
            new RegExp(filters.keyword, 'i'),
        );

        if (ObjectID.isValid(filters.keyword) === true) {
            findByCompanyId.company_id = addMongooseParam(
                findByCompanyId.company_id,
                '$eq',
                filters.keyword,
            );
        }
    }

    const searchParams = {
        $or: [findByName],
    };

    if (ObjectID.isValid(filters.keyword) === true) {
        searchParams['$or'].push(findByCompanyId);
    }

    if (typeof findByCompanyName.company_id !== 'undefined') {
        searchParams['$or'].push(findByCompanyName);
    }

    console.log(searchParams['$or']);
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
