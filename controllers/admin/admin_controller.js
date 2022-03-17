const adminRepository = require('../../repositories/admin_repository');
const {validationResult} = require('express-validator');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const auth = require('../../utils/validate_token');
const {validateRouter, addMongooseParam, getHeaders} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const bcrypt = require('bcryptjs');
const {ADMIN_STATUS, ALT_URL} = require('../../utils/consts');
const creatorUploadRepository = require('../../repositories/creator_upload_repository');
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
            const email = req.body.email;
            let admin = await adminRepository.findByEmail(email);
            if (admin) {
                return handlerError(req, res, ErrorMessage.ACCOUNT_IS_ALREADY_EXISTED);
            }

            //upload file
            // await creatorUploadRepository(req, res);

            let my_file = req.file;
            let imgName = my_file.filename.split('.');
            // let renameOutput = req.body.name + '.' + imgName[imgName.length -1];
            let renameOutput = email + '.' + imgName[imgName.length -1];
            // let renameOutput = 'peter.png';  <- Test
            //
            //rename
            // TODO : need to fix error
            // await imageRename(consts.UPLOAD_PATH + "creator/" + my_file.filename, consts.UPLOAD_PATH + "creator/" + renameOutput);
            // await imageRename(my_file.path, consts.UPLOAD_PATH + renameOutput);

            let newAccountAdmin = {
                full_name: req.body.full_name,
                email: req.body.email,
                password: req.body.password,
                level: req.body.level,
                image: ALT_URL + `creators/${my_file.filename}`,
                description: req.body.description,
                solana_address: req.body.solana_address,
                status: req.body.level === 'user' ? ADMIN_STATUS.ACTIVE : ADMIN_STATUS.INACTIVE
            };

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
            if (admin.status !== ADMIN_STATUS.ACTIVE) {
                return handlerError(req, res, ErrorMessage.ADMIN_IS_NOT_ACTIVE);
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
                level: admin.level,
                image: admin.image,
                description: admin.description
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
            let perPage;
            if (req.query.perPage) {
                perPage = +req.query.perPage || 5;
            }

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

            // TODO: admin의 email 주소가 바뀔 경우 주의할 것...
            const superUser = await adminRepository.findById(req.decoded.id, null);
            if (!superUser || superUser.level !== 'administrator') {
                return handlerError(req, res, ErrorMessage.YOUR_ACCOUNT_IS_NOT_PERMISSION_TO_UPDATE);
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

    async updateAdminAll(req, res, next) {
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

            // TODO: admin의 email 주소가 바뀔 경우 주의할 것...
            const superUser = await adminRepository.findById(req.decoded.id, null);
            if (!superUser || superUser.level !== 'administrator') {
                return handlerError(req, res, ErrorMessage.YOUR_ACCOUNT_IS_NOT_PERMISSION_TO_UPDATE);
            }

            const data = await getUpdateBodys(req.body);

            if (data.errors.length > 0) {
                return handlerError(req, res, data.errors.join(', '));
            }

            const update = await adminRepository.updateAll(req.body.ids, data.updateBodys);
            if (!update) {
                return handlerError(req, res, ErrorMessage.ACCOUNT_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, update);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateMyInfo(req, res, next) {
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

    async updatePassword(req, res, next) {
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
                return handlerError(req, res, ErrorMessage.YOUR_ACCOUNT_IS_NOT_PERMISSION_TO_UPDATE);
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

    if (filters.level) {
        findParams.level = addMongooseParam(
            findParams.level,
            '$regex',
            new RegExp(filters.level, 'i'),
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

    if (updates.status) {
        updateBodys.status = updates.status;
    }

    return {updateBodys: updateBodys, errors: errors};
}
