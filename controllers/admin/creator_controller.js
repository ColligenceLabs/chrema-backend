const creatorRepository = require('../../repositories/creator_repository');
const creatorUploadRepository = require('../../repositories/creator_upload_repository');
const listenerRepository = require('../../repositories/listener_repository');
const contractRepository = require('../../repositories/contract_repository');
const {validationResult} = require('express-validator');
const logger = require('../../utils/logger');
const {addMongooseParam, getHeaders, imageRename} = require('../../utils/helper');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {isEmptyObject, validateRouter, _errorFormatter} = require('../../utils/helper');
const {CREATOR_STATUS, ALT_URL} = require('../../utils/consts');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const consts = require('../../utils/consts');
var ObjectID = require('mongodb').ObjectID;

module.exports = {
    classname: 'CreatorController',

    createCreator: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            const email = req.body.email;
            console.log('1 ===>', email);
            var creator = await creatorRepository.findByEmail(req.body.email);
            if (creator.length) {
                console.log(ErrorMessage.CREATOR_IS_EXISTED);
                return handlerError(req, res, ErrorMessage.CREATOR_IS_EXISTED);
            }
            //upload file
            // await creatorUploadRepository(req, res);
            let my_file = req.file;
            let imgName = my_file.filename.split('.');
            console.log('2 ===>', imgName)
            // let renameOutput = req.body.name + '.' + imgName[imgName.length -1];
            let renameOutput = email + '.' + imgName[imgName.length -1];
            console.log('3 ===>', renameOutput)
            // let renameOutput = 'peter.png';  <- Test
            //
            //rename
            // TODO : need to fix error
            // await imageRename(consts.UPLOAD_PATH + "creator/" + my_file.filename, consts.UPLOAD_PATH + "creator/" + renameOutput);
            // await imageRename(my_file.path, consts.UPLOAD_PATH + renameOutput);

            //find contract
            // TODO: 추후 수정할 수 도있음. DB에 직접 contract를 추가하도록 한다.
            // Contract은 Collection에 매칭됨...
            // let contract = await contractRepository.findByContractAddress(process.env.NFT_CONTRACT_ADDR);
            // let contractId = new ObjectID(contract._id);
            var newCreator = {
                // email: req.body.email,
                email,
                name: req.body.name,
                description: req.body.description,
                // image: ALT_URL + 'creator/' + renameOutput,
                image: ALT_URL + my_file.path,
                // contract_id: contractId,
            };

            let result = await creatorRepository.create(newCreator);

            if (!result) {
                return handlerError(req, res, ErrorMessage.CREATE_CREATOR_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, result);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexCreator(req, res, next) {
        try {
            validateRouter(req, res);
            var findParams = getFindParams(req.query);
            findParams = {
                ...findParams,
                ...(req.query?.name && {name: req.query.name}),
            };

            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            var count = await creatorRepository.count(findParams);
            var responseHeaders = getHeaders(count, page, perPage);

            var creators = await creatorRepository.findAll(findParams, {page, perPage});
            if (!creators) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: creators,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getCreatorDetail(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            validateRouter(req, res);
            var creator = await creatorRepository.findById(req.params.id);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, creator);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateCreator(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var data = getUpdateBodys(req.body);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            var creator = await creatorRepository.findById(req.params.id);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            if (req.body.status === CREATOR_STATUS.SUSPEND) {
                return handlerError(req, res, ErrorMessage.STATUS_UPDATE_INVALID);
            }

            var updateCreator = await creatorRepository.updateById(req.params.id, data);
            if (!updateCreator) {
                return handlerError(req, res, ErrorMessage.UPDATE_CREATOR_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateCreator);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    //it works, but not use yet
    async deleteCreator(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const creator = await creatorRepository.findById(req.params.id);

            if (!creator) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const deleteCreator = await creatorRepository.delete(req.params.id);

            return handlerSuccess(req, res, {
                // serial: deleteCreator,
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

    if (filters.status) {
        findParams.status = filters.status;
    }

    if (filters.nft_id) {
        findParams.nft_id = filters.nft_id;
    }

    if (filters.owner_id) {
        findParams.owner_id = filters.owner_id;
    }

    return findParams;
}

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates.name) {
        updateBodys.name = updates.name;
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
