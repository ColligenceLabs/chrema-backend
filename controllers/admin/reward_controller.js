const {validationResult} = require('express-validator');
const rewardRepository = require('../../repositories/reward_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {_errorFormatter, addMongooseParam, getHeaders} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {REWARD_STATUS} = require('../../utils/consts');
const {isEmptyObject} = require('../../utils/helper');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
var ObjectID = require('mongodb').ObjectID;

module.exports = {
    classname: 'RewardController',

    createReward: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            var newReward = {
                name: req.body.name,
                tp_amount: req.body.tp_amount,
                quantity: req.body.quantity,
                remaining_amount: req.body.quantity,
                type: req.body.type * 1,
                ...(req.body?.description && {description: req.body.description}),
                ...(req.body?.status && {status: req.body.status}),
            };

            let reward = await rewardRepository.create(newReward);
            if (!reward) {
                return handlerError(req, res, ErrorMessage.CREATE_REWARD_IS_NOT_SUCCESS);
            }

            await rewardRepository.activeReward(reward._id, req.body.type * 1);

            return handlerSuccess(req, res, reward);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexRewards(req, res, next) {
        try {
            const findParams = getFindParams(req.query);
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            var count = await rewardRepository.count(findParams);
            var responseHeaders = getHeaders(count, page, perPage);

            var rewards = await rewardRepository.findAll(findParams, {page, perPage});
            if (!rewards) {
                return handlerError(req, res, ErrorMessage.REWARD_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: rewards,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getRewardDetail(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var reward = await rewardRepository.findById(req.params.id);
            if (!reward) {
                return handlerError(req, res, ErrorMessage.REWARD_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, reward);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateReward(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var data = getUpdateBodys(req.body);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            var reward = await rewardRepository.findById(req.params.id);
            if (!reward) {
                return handlerError(req, res, ErrorMessage.REWARD_IS_NOT_FOUND);
            }

            var updateReward = await rewardRepository.updateById(req.params.id, data);
            if (!updateReward) {
                return handlerError(req, res, ErrorMessage.UPDATE_REWARD_IS_NOT_SUCCESS);
            }

            if (data.status) {
                if (data.status == REWARD_STATUS.ACTIVE) {
                    await rewardRepository.activeReward(reward._id, reward.type);
                } else {
                    await rewardRepository.inactiveReward(reward._id);
                }
            }

            return handlerSuccess(req, res, updateReward);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteReward(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var reward = await rewardRepository.findById(req.params.id);
            if (!reward) {
                return handlerError(req, res, ErrorMessage.REWARD_IS_NOT_FOUND);
            }

            var deleteReward = await rewardRepository.updateById(req.params.id, {
                status: REWARD_STATUS.SUSPEND,
            });

            return handlerSuccess(req, res, deleteReward);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

function getFindParams(filters) {
    let findParams = {};

    if (filters.type) {
        findParams.type = filters.type;
    }

    if (filters.status) {
        findParams.status = filters.status;
    }

    if (filters.reward_id) {
        findParams.reward_id = addMongooseParam(
            findParams.reward_id,
            '$regex',
            new RegExp(filters.reward_id, 'i'),
        );
    }

    return findParams;
}

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates.name) {
        updateBodys.name = updates.name;
    }

    if (updates.description) {
        updateBodys.description = updates.description;
    }

    if (updates.tp_amount) {
        updateBodys.tp_amount = updates.tp_amount;
    }

    if (updates.quantity) {
        updateBodys.quantity = updates.quantity;
    }

    if (updates.remaining_amount) {
        updateBodys.remaining_amount = updates.remaining_amount;
    }

    if (updates.status) {
        updateBodys.status = updates.status;
    }

    if (!isEmptyObject(updateBodys)) {
        updateBodys.updatedAt = Date.now();
    }

    return updateBodys;
}
