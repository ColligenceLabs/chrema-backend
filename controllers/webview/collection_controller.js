const {validationResult} = require('express-validator');
const collectionRepository = require('../../repositories/collection_repository');
const nftRepository = require('../../repositories/nft_repository');
const userRepository = require('../../repositories/user_repository');
var serialRepository = require('../../repositories/serial_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {addMongooseParam, getHeaders} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {COLLECTION_STATUS, NFT_STATUS, COLLECTION_CATE} = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {isEmptyObject, validateRouter} = require('../../utils/helper');
var ObjectID = require('mongodb').ObjectID;
const consts = require('../../utils/consts');

module.exports = {
    classname: 'CollectionController',

    async indexCollections(req, res, next) {
        try {
            validateRouter(req, res);

            if (req.query.address) {
                let address = req.query.address;
                let user = await userRepository.findByUserAddress(address);
                if (!user) {
                    return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
                }

                let ownerId = user._id;

                var ownserSerials = await serialRepository.findByOwnerId(ownerId);
            } else {
                var ownserSerials = [];
            }

            const findParams = getFindParams(req.query);

            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            const count = await collectionRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            let collections = await collectionRepository.findAll(findParams, {page, perPage});
            if (!collections) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            collections = JSON.parse(JSON.stringify(collections));
            const nowTime = new Date();

            for (let i = 0; i < collections.length; i++) {
                collections[i].selling_time_status = consts.SELLING_TIME_STATUS.CLOSED;

                let nfts = await nftRepository.findAllNftsByCollectionId(collections[i]._id);
                nfts = JSON.parse(JSON.stringify(nfts));

                for (let j = 0; j < nfts.length; j++) {
                    if (
                        Date.parse(nfts[j].start_date) <= nowTime &&
                        nowTime < Date.parse(nfts[j].end_date) &&
                        nfts[j].quantity_selling > 0 &&
                        nfts[j].selling_status != consts.SELLING_STATUS.STOP
                    ) {
                        collections[i].selling_time_status = consts.SELLING_TIME_STATUS.SELLING;
                    }

                    let collected = false;

                    for (let z = 0; z < ownserSerials.length; z++) {
                        if (ownserSerials[z].nft_id._id == nfts[j]._id) {
                            if (ownserSerials[z].transfered == consts.TRANSFERED.NOT_TRANSFER) {
                                collected = true;
                                break;
                            }
                        }
                    }

                    nfts[j].collected = collected;
                }
                collections[i].nfts = nfts;
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
};

function getFindParams(filters) {
    let findParams = {};

    if (filters.token_id) {
        findParams.token_id = addMongooseParam(
            findParams.token_id,
            '$regex',
            new RegExp(filters.token_id, 'i'),
        );
    }

    if (filters.name) {
        findParams.name = filters.name;
    }

    if (filters.category) {
        findParams.category = filters.category;
    }

    if (filters.company) {
        findParams.company_id = filters.company;
    }

    if (!filters.status) {
        findParams.status = NFT_STATUS.ACTIVE;
    } else {
        findParams.status = filters.status;
    }

    return findParams;
}
