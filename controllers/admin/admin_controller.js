const adminRepository = require('../../repositories/admin_repository');
const {validationResult} = require('express-validator');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const auth = require('../../utils/validate_token');
const {validateRouter, addMongooseParam, getHeaders} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const bcrypt = require('bcryptjs');
let SALT_WORK_FACTOR = 10;

var ObjectID = require('mongodb').ObjectID;

let tokenList = [];

module.exports = {
    classname: 'AdminController',

    adminRegister: async (req, res, next) => {
        const validate = validateRouter(req, res);
        if (validate) {
            return handlerError(req, res, validate);
        }
        try {
            let newAccountAdmin = {
                full_name: req.body.full_name,
                email: req.body.email,
                password: req.body.password,
            };

            let admin = await adminRepository.findByEmail(newAccountAdmin.email);
            if (admin) {
                return handlerError(req, res, ErrorMessage.ACCOUNT_IS_ALREADY_EXISTED);
            }

            let createAdmin = await adminRepository.create(newAccountAdmin);

            return handlerSuccess(req, res, createAdmin);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    adminlogin: async (req, res, next) => {
        const validate = validateRouter(req, res);
        if (validate) {
            return handlerError(req, res, validate);
        }

        try {
            let accountAdmin = {
                email: req.body.email,
                password: req.body.password,
            };
            let comparePassword;
            let admin = await adminRepository.findByEmail(accountAdmin.email);
            if (!admin) {
                return handlerError(req, res, ErrorMessage.USERNAME_AND_PASSWORD_IS_INCORRECT);
            }
            await admin.comparePassword(accountAdmin.password).then((data) => {
                comparePassword = data;
            });
            if (!comparePassword) {
                return handlerError(req, res, ErrorMessage.USERNAME_AND_PASSWORD_IS_INCORRECT);
            }

            const adminInfor = {
                id: admin._id,
                full_name: admin.full_name,
                email: admin.email,
            };
            let accessToken = auth.generateAccessToken(adminInfor);
            let refreshToken = auth.generateRefreshToken({id: admin._id});
            tokenList[admin._id] = refreshToken;

            return handlerSuccess(req, res, {
                infor: adminInfor,
                accessToken: accessToken,
                refreshToken: refreshToken,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexAdmins(req, res, next) {
        try {
            const findParams = getFindParams(req.query);
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            const count = await adminRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const adminAccounts = await adminRepository.findAll(findParams, {page, perPage});

            return handlerSuccess(req, res, {
                items: adminAccounts,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getDetailAdmin(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const admin = await adminRepository.findById(req.params.id);
            if (!admin) {
                return handlerError(req, res, ErrorMessage.ACCOUNT_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, admin);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateAdmin(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const validate = validateRouter(req, res);
            if (validate) {
                return handlerError(req, res, validate);
            }

            const admin = await adminRepository.findById(req.params.id, null);
            if (!admin) {
                return handlerError(req, res, ErrorMessage.ACCOUNT_IS_NOT_FOUND);
            }

            if (req.decoded.id !== req.params.id) {
                return handlerError(req, res, ErrorMessage.YOUR_ACCOUNT_IS_NOT_PERMISSION);
            }

            const data = await getUpdateBodys(req.body);

            if (data.errors.length > 0) {
                return handlerError(req, res, data.errors.join(', '));
            }

            if (data.updateBodys.password) {
                let comparePassword;

                await admin.comparePassword(data.updateBodys.old_password).then((data) => {
                    comparePassword = data;
                });
                if (!comparePassword) {
                    return handlerError(req, res, ErrorMessage.OLD_PASSWORD_IS_INCORRECT);
                }

                const salt = await bcrypt.genSalt(SALT_WORK_FACTOR);
                const newPass = await bcrypt.hash(data.updateBodys.password, salt);
                data.updateBodys.password = newPass;
            }

            const update = await adminRepository.update(req.params.id, data.updateBodys);
            if (!update) {
                return handlerError(req, res, ErrorMessage.ACCOUNT_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, update);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

function getFindParams(filters) {
    let findParams = {};

    if (filters.email) {
        findParams.email = addMongooseParam(
            findParams.email,
            '$regex',
            new RegExp(filters.email, 'i'),
        );
    }

    if (filters.full_name) {
        findParams.full_name = addMongooseParam(
            findParams.full_name,
            '$regex',
            new RegExp(filters.full_name, 'i'),
        );
    }

    return findParams;
}

async function getUpdateBodys(updates) {
    let updateBodys = {};
    let errors = [];

    if (updates?.full_name) {
        updateBodys.full_name = updates.full_name;
    }

    if (updates?.admin_address) {
        updateBodys.admin_address = updates.admin_address;
    }

    if (updates?.email) {
        const isExist = await adminRepository.findByEmail(updates.email);
        if (isExist) {
            errors.push(ErrorMessage.EMAIL_IS_EXISTED);
        }

        updateBodys.email = updates.email;
    }

    if (updates.password) {
        if (!updates.old_password) {
            errors.push(ErrorMessage.OLD_PASSWORD_IS_REQUIRE);
        }

        updateBodys.old_password = updates.old_password;
        updateBodys.password = updates.password;
    }

    return {updateBodys: updateBodys, errors: errors};
}
