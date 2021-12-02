const {validationResult} = require('express-validator');
const userRepository = require('../../repositories/user_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const auth = require('../../utils/validate_token');
const {
    validateRouter,
    isEmptyObject,
    addMongooseParam,
    getHeaders,
    checkExistedDocument,
} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {USER_STATUS} = require('../../utils/consts');
var ObjectID = require('mongodb').ObjectID;
const {handlerSuccess, handlerError} = require('../../utils/handler_response');

module.exports = {
    classname: 'UserController',
    createUser: async (req, res, next) => {
        try {
            let newUser = {
                uid: req.body.uid,
                ...(req.body?.status && {status: req.body.status}),
            };

            let user = await userRepository.createUser(newUser);
            if (!user) {
                return handlerError(req, res, ErrorMessage.CREATE_USER_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, user);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexUsers(req, res, next) {
        try {
            const findParams = getFindParams(req.query);
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            const count = await userRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const users = await userRepository.findAll(findParams, {page, perPage});
            if (!users) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: users,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getDetailUser(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }
            validateRouter(req, res);

            const user = await userRepository.findById(req.params.id);
            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, user);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateUser(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }
            validateRouter(req, res);

            const data = getUpdateBodys(req.body);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            const user = await userRepository.findById(req.params.id);
            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }

            const updateUser = await userRepository.update(req.params.id, data);
            if (!updateUser) {
                return handlerError(req, res, ErrorMessage.UPDATE_USER_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateUser);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteUser(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }
            validateRouter(req, res);

            const user = await userRepository.findById(req.params.id);
            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }

            const deleteUser = await userRepository.delete(req.params.id, {
                status: USER_STATUS.SUSPEND,
            });
            if (!deleteUser) {
                return handlerError(req, res, ErrorMessage.DELETE_USER_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, deleteUser);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteManyUser(req, res, next) {
        try {
            const user_ids = req.body.user_ids;

            user_ids.forEach((item) => {
                if (ObjectID.isValid(item) === false) {
                    return handlerError(req, res, `Id '${item}' is not ObjectId`);
                }
            });

            const errorIds = await checkExistedDocument(userRepository, user_ids);
            if (errorIds.length > 0) {
                return handlerError(req, res, `Ids '${errorIds.join(', ')}' is not found!`);
            }
            const deleteUsers = await userRepository.deleteMany(user_ids, {
                status: USER_STATUS.SUSPEND,
            });

            if (!deleteUsers) {
                return handlerError(req, res, 'Delete many users are not successed');
            }
            return handlerSuccess(req, res, {user: deleteUsers});
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

function getFindParams(filters) {
    let findParams = {};

    if (filters.keyword) {
        findParams['$or'] = [
            {
                address: addMongooseParam(
                    findParams.address,
                    '$regex',
                    new RegExp(filters.keyword, 'i'),
                ),
            },
        ];
    }

    if (filters.status) {
        findParams.status = filters.status;
    }

    return findParams;
}

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates?.status) {
        updateBodys.status = updates.status;
    }

    return updateBodys;
}
