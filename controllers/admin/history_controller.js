const {v4: uuidv4} = require('uuid');
const {validationResult} = require('express-validator');
const historyRepository = require('../../repositories/history_repository');
var ObjectID = require('mongodb').ObjectID;

const auth = require('../../utils/validate_token');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {isEmptyObject} = require('../../utils/helper');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {TRANSACTION_STATUS} = require('../../utils/consts');
const logger = require('../../utils/logger');
const {_errorFormatter, addMongooseParam, getHeaders} = require('../../utils/helper');

module.exports = {
    classname: 'HistoryController',

    createTx: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            const newTx = {
                tx_id: uuidv4(),
                serial_id: req.body.serial_id,
                ...(req.body?.seller && {seller: req.body.seller}),
                ...(req.body?.buyer && {buyer: req.body.buyer}),
                ...(req.body?.price && {price: req.body.price}),
                date: Date.now(),
                status: req.body.status,
            };

            let tx = await historyRepository.createTx(newTx);
            if (!tx) {
                return handlerError(req, res, ErrorMessage.CREATE_HISTORY_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, tx);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexTxs(req, res, next) {
        try {
            const findParams = await getFindParams(req.query);
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;
            const count = await historyRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const txs = await historyRepository.findAllTx(findParams, {page, perPage});
            if (!txs) {
                return handlerError(req, res, ErrorMessage.HISTORY_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: txs,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getDetailTx(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const tx = await historyRepository.findByTxId(req.params.id);
            if (!tx) {
                return handlerError(req, res, ErrorMessage.HISTORY_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, tx);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateTx(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const data = getUpdateBodys(req.body);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            const tx = await historyRepository.findByTxId(req.params.id);
            if (!tx) {
                return handlerError(req, res, ErrorMessage.HISTORY_IS_NOT_FOUND);
            }

            const updateTx = await historyRepository.update(req.params.id, data);
            if (!updateTx) {
                return handlerError(req, res, ErrorMessage.UPDATE_HISTORY_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateTx);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteTx(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const tx = await historyRepository.findByTxId(req.params.id);
            if (!tx) {
                return handlerError(req, res, ErrorMessage.HISTORY_IS_NOT_FOUND);
            }

            const deleteTx = await historyRepository.update(req.params.id, {
                status: TRANSACTION_STATUS.CANCEL,
            });

            return handlerSuccess(req, res, deleteTx);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

async function getFindParams(filters) {
    let findParams = {};

    if (filters.date) {
        findParams.date = {$eq: new Date(date)};
    }

    if (filters.status) {
        findParams.status = filters.status;
    }

    const findByBuyerId = Object.assign({}, findParams);
    const findBySellerId = Object.assign({}, findParams);
    const findByTokenId = Object.assign({}, findParams);

    if (filters.keyword) {
        const buyerIds = await historyRepository.findByBuyerAddress(filters.keyword);
        const sellerIds = await historyRepository.findBySellerAddress(filters.keyword);
        const serialIds = await historyRepository.findBySerialTokenIds(filters.keyword);

        if (buyerIds && buyerIds.length > 0) {
            findByBuyerId.buyer = buyerIds;
        }

        if (sellerIds && sellerIds.length > 0) {
            findBySellerId.seller = sellerIds;
        }

        if (serialIds && serialIds.length > 0) {
            findByTokenId.serial_id = serialIds;
        }
    }

    const findByTxId = Object.assign({}, findParams);
    const findBySerialId = Object.assign({}, findParams);

    if (filters.keyword) {
        findByTxId.tx_id = addMongooseParam(
            findByTxId.tx_id,
            '$regex',
            new RegExp(filters.keyword, 'i'),
        );

        if (ObjectID.isValid(filters.keyword) === true) {
            findBySerialId.serial_id = addMongooseParam(
                findBySerialId.serial_id,
                '$eq',
                filters.keyword,
            );
        }
    }

    const searchParams = {
        $or: [findByTxId],
    };

    if (ObjectID.isValid(filters.keyword) === true) {
        searchParams['$or'].push(findBySerialId);
    }

    if (typeof findByBuyerId.buyer !== 'undefined') {
        searchParams['$or'].push(findByBuyerId);
    }

    if (typeof findBySellerId.seller !== 'undefined') {
        searchParams['$or'].push(findBySellerId);
    }

    if (typeof findByTokenId.serial_id !== 'undefined') {
        searchParams['$or'].push(findByTokenId);
    }

    return searchParams;
}

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates.price) {
        updateBodys.price = updates.price;
    }

    if (updates.status) {
        updateBodys.status = updates.status;
    }

    if (!isEmptyObject(updateBodys)) {
        updateBodys.updatedAt = Date.now();
    }

    return updateBodys;
}
