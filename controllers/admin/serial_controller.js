const serialRepository = require('../../repositories/serial_repository');
const adminRepository = require('../../repositories/admin_repository');
const nftRepository = require('../../repositories/nft_repository');
const nftBlockchain = require('../blockchain/nft_controller');
const userRepository = require('../../repositories/user_repository');
const listenerRepository = require('../../repositories/listener_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {addMongooseParam, getHeaders, checkExistedDocument} = require('../../utils/helper');
const logger = require('../../utils/logger');
const {SERIAL_STATUS} = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const {isEmptyObject, validateRouter, calcQuantitySellingNumber} = require('../../utils/helper');
var ObjectID = require('mongodb').ObjectID;

module.exports = {
    classname: 'SerialController',

    createSerial: async (req, res, next) => {
        try {
            validateRouter(req, res);
            const nft_id = req.body.nft_id;

            const nft = await nftRepository.findById(nft_id);

            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            let count = await serialRepository.count({nft_id: nft_id});

            var new_serials = {
                item: [],
            };

            //get all nft from blockchain service
            let itemList = await nftRepository.getItemList();
            //sort with value
            itemList.items.sort(function (a, b) {
                return (
                    parseInt(b.tokenId.replace('0x', ''), 16) -
                    parseInt(a.tokenId.replace('0x', ''), 16)
                );
            });

            // get last tokenId in db
            let lastTokenId = await listenerRepository.findLastTokenId();

            let tokenIdBlockchain = itemList.items[0].tokenId;
            let tokenId = parseInt(tokenIdBlockchain.replace('0x', ''), 16);

            if (lastTokenId) {
                if (tokenId < lastTokenId[0].token_id) {
                    tokenId = parseInt(lastTokenId[0].token_id);
                }
            }

            let quantity = req.body.quantity;
            let tokenIds = [];

            for (let i = 0; i < quantity; i++) {
                let newTokenId = tokenId + 1 + i;
                tokenIds.push('0x' + newTokenId.toString(16));
                // create new record in serial table
                const newSerial = {
                    nft_id: nft_id,
                    index: count + 1,
                    type: nft.type,
                    token_id: tokenIds[i],
                    status: SERIAL_STATUS.INACTIVE,
                };
                count = count + 1;

                var serial = await serialRepository.create(newSerial);

                if (!serial) {
                    // return handlerError(req, res, ErrorMessage.CREATE_SERIAL_IS_NOT_SUCCESS);
                    continue;
                }
                new_serials.item.push(serial);
            }

            for (let i = 0; i < quantity; i++) {
                let to = req.body.admin_address;
                let tokenUri = nft.metadata.image;

                //mint nft
                let mintResult = await nftBlockchain._mint(to, tokenIds[i], tokenUri);

                if (mintResult.status !== 200) {
                    return handlerError(req, res, {error: mintResult.error});
                    continue;
                }
            }

            return handlerSuccess(req, res, new_serials);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async salesCount(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const owner = req.query.account;
            const findParams = {nft_id: req.params.id, status: 'active', owner_id: {$in: [owner, null]}};

            const count = await serialRepository.count(findParams);
            const serial = await serialRepository.findOneSerial(findParams);

            return handlerSuccess(req, res, {
                count: count, tokenId: serial?.token_id
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexSerials(req, res, next) {
        try {
            validateRouter(req, res);
            var findParams = await getFindParams(req.query);
            findParams = {
                ...findParams,
                ...(req.query?.type && {type: req.query.type * 1}),
            };

            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            const count = await serialRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const serials = await serialRepository.findAll(findParams, {page, perPage});

            if (!serials) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, {
                items: serials,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getDetailSerial(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            validateRouter(req, res);
            const serial = await serialRepository.findByIdSerial(req.params.id);
            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, serial);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateSerial(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const data = getUpdateBodys(req.body);
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            if (req.body.status === SERIAL_STATUS.SUSPEND) {
                return handlerError(req, res, ErrorMessage.STATUS_UPDATE_INVALID);
            }

            const serial = await serialRepository.findByIdSerial(req.params.id);
            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            const updateSerial = await serialRepository.updateById(req.params.id, data);
            if (!updateSerial) {
                return handlerError(req, res, ErrorMessage.UPDATE_SERIAL_IS_NOT_SUCCESS);
            }

            if (updateSerial && typeof data.status !== 'undefined') {
                const serialArr = await serialRepository.findAllSerialWithCondition({
                    nft_id: serial.nft_id,
                    status: 'active',
                });

                const quantitySelling = calcQuantitySellingNumber(serialArr);

                await nftRepository.update(serial.nft_id, {
                    quantity_selling: quantitySelling,
                });
            }

            return handlerSuccess(req, res, updateSerial);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateOwner(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }
            console.log('--->', req.body)
            const data = getUpdateBodys(req.body);
            console.log('--->', data)
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            const tokenIdHex = '0x' + parseInt(req.params.tokenId, 10).toString(16);
            const search = {nft_id: req.params.id, token_id: tokenIdHex};
            const serial = await serialRepository.findOneSerial(search);
            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            const updateSerial = await serialRepository.updateById(serial._id, data);
            if (!updateSerial) {
                return handlerError(req, res, ErrorMessage.UPDATE_SERIAL_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateSerial);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateLink(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }
            console.log('--->', req.body)
            const data = getUpdateBodys(req.body);
            console.log('--->', data)
            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            const search = {_id: req.params.id};
            const serial = await serialRepository.findOneSerial(search);
            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            const updateSerial = await serialRepository.updateById(serial._id, data);
            if (!updateSerial) {
                return handlerError(req, res, ErrorMessage.UPDATE_SERIAL_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateSerial);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateSerials(req, res, next) {
        try {
            // const data = getUpdateBodys(req.body);
            // console.log('--->', data)
            // if (isEmptyObject(data)) {
            //     return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            // }

            const ids = [];
            const start = parseInt(req.body.tokenId, 10);
            const end = start + parseInt(req.body.quantity, 10);
            for (let i = start; i < end; i++) {
                const hexId = '0x' + i.toString(16);
                const serial = await serialRepository.findAllSerialWithCondition({nft_id: req.body.nftId, token_id: hexId});
                if (!serial) {
                    return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
                }
                ids.push(serial[0]._id);
            }

            const updateSerials = await serialRepository.updateByIds(ids, {status: 'active'});
            if (!updateSerials) {
                return handlerError(req, res, ErrorMessage.UPDATE_SERIAL_IS_NOT_SUCCESS);
            }

            for (let i = 0; i < ids.length; i++) {
                const updateSerial = await serialRepository.updateById(ids[i], {contract_address: req.body.pubkeys[i]});
                if (!updateSerial) {
                    return handlerError(req, res, ErrorMessage.UPDATE_SERIAL_IS_NOT_SUCCESS);
                }
            }

            return handlerSuccess(req, res, updateSerials);
        } catch (error) {
            console.log(error);
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteSerial(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const serial = await serialRepository.findByIdSerial(req.params.id);
            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            let adminAddress = await adminRepository.getAdminAddress();

            const deleteSerial = await serialRepository.delete(
                serial.owner_id,
                serial.token_id,
                req.params.id,
                adminAddress,
            );

            if (deleteSerial) {
                const serialArr = await serialRepository.findAllSerialWithCondition({
                    nft_id: serial.nft_id,
                    status: 'active',
                });

                const quantitySelling = calcQuantitySellingNumber(serialArr);

                await nftRepository.update(serial.nft_id, {
                    quantity_selling: quantitySelling,
                });
            }
            return handlerSuccess(req, res, deleteSerial);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteManySerial(req, res, next) {
        try {
            const serial_ids = req.body.serial_ids;

            serial_ids.forEach((item) => {
                if (ObjectID.isValid(item) === false) {
                    return handlerError(req, res, `id '${item}' is invalid`);
                }
            });

            const errorIds = await checkExistedDocument(serialRepository, serial_ids);
            if (errorIds.length > 0) {
                return handlerError(req, res, `Ids '${errorIds.join(', ')}' is not found!`);
            }

            let adminAddress = await adminRepository.getAdminAddress();

            const deleteSerials = await serialRepository.deleteMany(serial_ids, adminAddress);

            if (!deleteSerials) {
                return handlerError(req, res, 'Delete many serials are not successed');
            }

            return handlerSuccess(req, res, {serial: deleteSerials});
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

async function getFindParams(filters) {
    let findParams = {};

    if (filters.status) {
        findParams.status = filters.status;
    }

    if (filters.type) {
        findParams.type = filters.type;
    }
    //Don't move the place of code under this line.
    const findByNftName = Object.assign({}, findParams);

    if (filters.nft_id) {
        findParams.nft_id = filters.nft_id;
    }

    const findByOwnerAddress = Object.assign({}, findParams);

    if (filters.keyword) {
        const nftIds = await nftRepository.findIdsNftByName(filters.keyword);
        // const users = await userRepository.findIdsUserByAddress(filters.keyword);

        if (nftIds && nftIds.length > 0) {
            if (filters.nft_id) {
                let count = 0;
                nftIds.map((item) => {
                    if (item == filters.nft_id) {
                        count += 1;
                    }
                });
                if (count > 0) {
                    findByNftName.nft_id = filters.nft_id;
                }

                if (count == 0) {
                    findByNftName.nft_id = [];
                }
            }

            if (!filters.nft_id) {
                findByNftName.nft_id = nftIds;
            }
        }

        // if (users && users.length > 0) {
        //     findByOwnerAddress.owner_id = users;
        // }
    }

    const findByTokenId = Object.assign({}, findParams);
    const findByOwnerId = Object.assign({}, findParams);

    if (filters.keyword) {
        findByTokenId.token_id = addMongooseParam(
            findByTokenId.token_id,
            '$regex',
            new RegExp(filters.keyword, 'i'),
        );

        if (ObjectID.isValid(filters.keyword) === true) {
            findByOwnerId.owner_id = addMongooseParam(
                findByOwnerId.owner_id,
                '$eq',
                filters.keyword,
            );
        }
    }

    const searchParams = {
        $or: [findByTokenId],
    };

    if (ObjectID.isValid(filters.keyword) === true) {
        searchParams['$or'].push(findByOwnerId);
    }

    if (typeof findByNftName.nft_id !== 'undefined') {
        searchParams['$or'].push(findByNftName);
    }

    if (typeof findByOwnerAddress.owner_id !== 'undefined') {
        searchParams['$or'].push(findByOwnerAddress);
    }

    return searchParams;
}

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates.token_id) {
        updateBodys.token_id = updates.token_id;
    }

    if (updates.status) {
        updateBodys.status = updates.status;
    }

    if (updates.index) {
        updateBodys.index = updates.index;
    }

    if (updates.price) {
        updateBodys.price = updates.price;
    }

    if (updates.owner_id) {
        updateBodys.owner_id = updates.owner_id;
    }

    if (updates.ipfs_link) {
        updateBodys.ipfs_link = updates.ipfs_link;
    }

    if (updates.transfered === 0 || updates.transfered === 1) {
        updateBodys.transfered = updates.transfered;
    }

    if (!isEmptyObject(updateBodys)) {
        updateBodys.updatedAt = Date.now();
    }

    return updateBodys;
}
