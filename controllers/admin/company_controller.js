const companyRepository = require('../../repositories/company_repository');
const companyUploadRepository = require('../../repositories/company_upload_repository');
const listenerRepository = require('../../repositories/listener_repository');
const contractRepository = require('../../repositories/contract_repository');
const {validationResult} = require('express-validator');
const logger = require('../../utils/logger');
const {addMongooseParam, getHeaders, imageRename} = require('../../utils/helper');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {isEmptyObject, validateRouter, _errorFormatter} = require('../../utils/helper');
const {COMPANY_STATUS, ALT_URL} = require('../../utils/consts');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const consts = require('../../utils/consts');
var ObjectID = require('mongodb').ObjectID;

module.exports = {
    classname: 'CompanyController',

    createCompany: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }                  

            var company = await companyRepository.findByName(req.body.name);
            if (company.length) {
                console.log(ErrorMessage.COMPANY_IS_EXISTED);
                return handlerError(req, res, ErrorMessage.COMPANY_IS_EXISTED);
            }
            //upload file
            await companyUploadRepository(req, res);
            let my_file = req.file;
            let imgName = my_file.filename.split('.');  
            let renameOutput = req.body.name + '.' + imgName[imgName.length -1];

            //rename
            await imageRename(consts.UPLOAD_PATH + "company/" + my_file.filename, consts.UPLOAD_PATH + "company/" + renameOutput);            
            
            //find contract
            // TODO: 추후 수정할 수 도있음. DB에 직접 contract를 추가하도록 한다.
            let contract = await contractRepository.findByContractAddress(process.env.NFT_CONTRACT_ADDR);
            let contractId = new ObjectID(contract._id);
            var newCompany = {
                name: req.body.name,
                description: req.body.description,
                image: ALT_URL + 'company/' + renameOutput,
                contract_id: contractId,
            };

            let result = await companyRepository.create(newCompany);

            if (!result) {
                return handlerError(req, res, ErrorMessage.CREATE_COMPANY_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, result);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexCompany(req, res, next) {
        try {
            validateRouter(req, res);
            var findParams = getFindParams(req.query);
            findParams = {
                ...findParams,
                ...(req.query?.name && {name: req.query.name}),
            };

            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            var count = await companyRepository.count(findParams);
            var responseHeaders = getHeaders(count, page, perPage);

            var companys = await companyRepository.findAll(findParams, {page, perPage});
            if (!companys) {
                return handlerError(req, res, ErrorMessage.COMPANY_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: companys,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getCompanyDetail(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            validateRouter(req, res);
            var company = await companyRepository.findById(req.params.id);
            if (!company) {
                return handlerError(req, res, ErrorMessage.COMPANY_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, company);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateCompany(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            var data = getUpdateBodys(req.body);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            var company = await companyRepository.findById(req.params.id);
            if (!company) {
                return handlerError(req, res, ErrorMessage.COMPANY_IS_NOT_FOUND);
            }

            if (req.body.status === COMPANY_STATUS.SUSPEND) {
                return handlerError(req, res, ErrorMessage.STATUS_UPDATE_INVALID);
            }

            var updateCompany = await companyRepository.updateById(req.params.id, data);
            if (!updateCompany) {
                return handlerError(req, res, ErrorMessage.UPDATE_COMPANY_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateCompany);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    //it works, but not use yet
    async deleteCompany(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const company = await companyRepository.findById(req.params.id);

            if (!company) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const deleteCompany = await companyRepository.delete(req.params.id);

            return handlerSuccess(req, res, {
                // serial: deleteCompany,
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
