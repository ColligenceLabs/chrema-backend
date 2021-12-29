const {validationResult} = require('express-validator');
const logger = require('../../utils/logger');
var ObjectID = require('mongodb').ObjectID;

const nftRepository = require('../../repositories/nft_repository');
const adminRepository = require('../../repositories/admin_repository');
const serialRepository = require('../../repositories/serial_repository');
const nftBlockchain = require('../blockchain/nft_controller');
const companyRepository = require('../../repositories/company_repository');
const uploadRepository = require('../../repositories/upload_repository');
const listenerRepository = require('../../repositories/listener_repository');
const contractRepository = require('../../repositories/contract_repository');
const consts = require('../../utils/consts');
const fs = require('fs');

const {
    _errorFormatter,
    addMongooseParam,
    getHeaders,
    checkExistedDocument,
    isEmptyObject,
    checkTimeCurrent,
    convertTimezone,
    imageResize,
    imageRename,
    writeJson,
} = require('../../utils/helper');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {
    NFT_STATUS,
    NFT_TYPE,
    SERIAL_STATUS,
    IPFS_URL,
    ALT_URL,
    SELLING_STATUS,
} = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');

module.exports = {
    classname: 'NftController',

    // createNft 순서 : 1. 파일업로드 (db, ipfs업로드  -> 파일명 해시값으로변경 -> 이미지일경우 리사이즈, 원본과 리사이즈 모두 저장한다)
    //                 2. json 업로드 (db, ipfs)
    //                 3. db저장
    //                 4. 민팅
    // TODOS: 대량의 민트 (2000개 이상)를 안정적으로 하는 로직 만들기


    createNft: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            let admin_address = req.body.admin_address;

            //upload file
            await uploadRepository(req, res);
            let my_file = req.files.file[0];

            errors = validateCreateNft(req, res);
            if (errors) {
                return handlerError(req, res, errors[0]);
            }

            let result = await nftRepository.addFileToIPFS(my_file);
            let imgName = my_file.filename.split('.');
            let imgInput = my_file.filename;

            let renameOutput = result.Hash + '.' + imgName[imgName.length -1];
            let imgOutput = result.Hash + '_resize.' + imgName[imgName.length -1];

            //rename
            await imageRename(consts.UPLOAD_PATH + imgInput, consts.UPLOAD_PATH + renameOutput);
            
            // //resize
            // if (imgName[imgName.length -1].toLowerCase() === 'jpg'| imgName[imgName.length -1].toLowerCase() === 'png' | imgName[imgName.length -1].toLowerCase() === 'jpeg')
            // await imageResize('./uploads/' + renameOutput, './uploads/' + imgOutput);
            
            //thumbnail check
            let thumbName = null;
            if (typeof req.files.thumbnail != 'undefined') {
                let my_thumbnail = req.files.thumbnail[0];
                thumbName = my_thumbnail.filename.split('.');
                let thumbnailInput = my_thumbnail.filename;
                let thumbnailOutput = result.Hash + '_thumbnail.' + thumbName[thumbName.length -1];
                await imageRename(consts.UPLOAD_PATH + thumbnailInput, consts.UPLOAD_PATH + 'thumbnail/' + thumbnailOutput);
            }

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
            let tokenIdBlockchain = itemList.items.length === 0 ? "1000" : itemList.items[0].tokenId;
            let tokenId = parseInt(tokenIdBlockchain.replace('0x', ''), 16);
            if (lastTokenId && lastTokenId.length !== 0) {
                if (tokenId < lastTokenId[0].token_id) {
                    tokenId = parseInt(lastTokenId[0].token_id);
                }
            }

            //check company
            let company = await companyRepository.findById(req.body.company_id);
            if (!company) {
                return handlerError(req, res, ErrorMessage.COMPANY_IS_NOT_FOUND);
            }

            //check contract
            // TODO: 2021.12.28 추후 수정할 수 도 있음. 지금은 DB에 직접 contract를 추가하도록 한다.
            let contract = await contractRepository.findByContractAddress(process.env.NFT_CONTRACT_ADDR);
            let contractId = new ObjectID(contract._id);

            let quantity = req.body.quantity;
            let tokenIds = [];
            let decimalTokenIds = [];
            let newNfts = [];
            let newSerials = [];
            let ipfs_links = [];

            for (let i = 0; i < quantity; i++) {
                let newTokenId = tokenId + 1 + i;
                tokenIds.push('0x' + newTokenId.toString(16));
                decimalTokenIds.push(newTokenId.toString());
            }
            //nft default
            for (let i = 0; i < quantity; i++) {
                // 수량에 맞춰 newNft를 만들고 newNfts배열에 저장
                let newNft = {
                    metadata: {
                        name: req.body.name,
                        description: req.body.description,
                        image: IPFS_URL + result.Hash,
                        alt_url: ALT_URL + result.Hash + '.' + imgName[imgName.length -1],
                        content_Type: imgName[imgName.length -1],
                        cid: result.Hash,
                        tokenId: decimalTokenIds[i],
                        total_minted: "",
                        external_url: req.body.external_url,
                        attributes: [],
                        minted_by: "Talken",
                        thumbnail: "",
                    },
                    company_id: req.body.company_id,
                    type: req.body.type * 1,
                    ...(req.body?.price && {price: req.body.price}),
                    ...(req.body?.quantity && {quantity: req.body.quantity}),
                    ...(req.body?.quantity && {quantity_selling: req.body.quantity}),
                    ...(req.body?.start_date && {start_date: req.body.start_date}),
                    ...(req.body?.end_date && {end_date: req.body.end_date}),
                    ...(req.body?.status && {status: req.body.status}),
                    ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                    ...(req.body?.description && {description: req.body.description}),
                    ...(req.body?.rarity && {rarity: req.body.rarity}),
                    contract_id: contractId,
                };
    
                let metadata_ipfs = newNft.metadata;
                if (req.body.category) {
                    // metadata_ipfs.category = JSON.parse(req.body.category);
                }
                if (req.body.quantity) {
                    metadata_ipfs.total_minted = JSON.parse(req.body.quantity);
                }

                //thumbnail check
                if (typeof req.files.thumbnail != 'undefined') {
                    metadata_ipfs.thumbnail = ALT_URL + 'thumbnail/' + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
                }
    
                let metadata_ipfs_link = await nftRepository.addJsonToIPFS(metadata_ipfs);
                // remove ipfs links array from metadata
                // let ipfs_link_item = {
                //     tokenId: decimalTokenIds[i],
                //     path: IPFS_URL + metadata_ipfs_link.Hash
                // }
                // ipfs_links.push(ipfs_link_item);
                // newNft.ipfs_links = ipfs_links;
                ipfs_links.push(IPFS_URL + metadata_ipfs_link.Hash)
                newNft.ipfs_link = IPFS_URL + metadata_ipfs_link.Hash;

                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }
    
                // write json file
                await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadata_ipfs));

                if (newNft.start_date && newNft.end_date) {
                    let current_time = new Date();
    
                    let startDate = new Date(convertTimezone(newNft.start_date).setSeconds(0, 0));
                    if (startDate > current_time) {
                        newNft.start_date = startDate;
                    } else {
                        return handlerError(req, res, ErrorMessage.START_DATE_IS_INVALID);
                    }
    
                    // check end_date
                    let endDate = new Date(convertTimezone(newNft.end_date).setSeconds(0, 0));
                    if (endDate > current_time && endDate > startDate) {
                        newNft.end_date = endDate;
                    } else {
                        return handlerError(req, res, ErrorMessage.END_DATE_IS_INVALID);
                    }
                }
    
                //serial default
                const newSerial = {
                    type: req.body.type,
                    ...(req.body?.status && {status: req.body.status}),
                };
    
                if (newNft.type === 1) {
                    newNft.price = 0;
                }
                newNfts.push(newNft);
                newSerials.push(newSerial);
            }

            let nft = await nftRepository.create(newNfts[0], newSerials[0], tokenIds);

            if (!nft) {
                return handlerError(req, res, ErrorMessage.CREATE_NFT_IS_NOT_SUCCESS);
            }
            for (let i = 0; i < tokenIds.length; i++) {
                let to = admin_address;
                let newTokenId = tokenIds[i];
                let tokenUri = ipfs_links[i];
                // mint nft
                let mintResult = await nftBlockchain._mint(to, newTokenId, tokenUri);
                if (mintResult.status !== 200) {
                    // return handlerError(req, res, {error: mintResult.error});
                    continue;
                }
            }

            return handlerSuccess(req, res, nft);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async indexNfts(req, res, next) {
        try {
            var findParams = getFindParams(req.query);
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            const count = await nftRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const nfts = await nftRepository.findAll(findParams, {page, perPage});
            if (!nfts) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const productRes = convertProductResponse(nfts);
            return handlerSuccess(req, res, {
                items: productRes,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getDetailNft(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const nft = await nftRepository.findById(req.params.id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            return handlerSuccess(req, res, nft);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateNft(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const nft = await nftRepository.findById(req.params.id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            if (req.body.status === NFT_STATUS.SUSPEND) {
                return handlerError(req, res, ErrorMessage.STATUS_UPDATE_INVALID);
            }

            let selling_status = SELLING_STATUS.SELL;
            if (nft.selling_status == SELLING_STATUS.SELL) {
                selling_status = SELLING_STATUS.STOP;
            }

            const updateNft = await nftRepository.update(req.params.id, {
                selling_status: selling_status,
            });
            if (!updateNft) {
                return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateNft);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateNftStatus(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const nft = await nftRepository.findById(req.params.id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            if (req.body.status === NFT_STATUS.SUSPEND) {
                return handlerError(req, res, ErrorMessage.STATUS_UPDATE_INVALID);
            }

            let status = NFT_STATUS.ACTIVE;
            if (nft.status == NFT_STATUS.ACTIVE) {
                status = NFT_STATUS.INACTIVE;
            }

            let serials = await serialRepository.findByNftId(req.params.id);

            let serialStatus = [SERIAL_STATUS.ACTIVE, SERIAL_STATUS.INACTIVE];
            let serialIds = [];
            for (let i = 0; i < serials.length; i++) {
                if (serials[i].owner_id == null && serialStatus.includes(serials[i].status)) {
                    serialIds.push(serials[i]._id);
                }
            }
            const updateSerials = await serialRepository.update({_id: serialIds}, {status: status});

            if (updateSerials) {
                const updateNft = await nftRepository.update(req.params.id, {
                    status: status,
                });
                if (!updateNft) {
                    return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
                }

                return handlerSuccess(req, res, updateNft);
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateSchedule(req, res, next) {
        try {
            var data = getUpdateScheduleBodys(req.body);

            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            var nfts = await nftRepository.findByIds(req.body.ids);

            if (!nfts.length) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            let current_time = new Date();
            let input = {};
            const errorNftIds = [];
            const sellingStatusSellArr = [];
            const sellingStatusStopArr = [];
            // selling status = 0 vs time > now > time
            for (let i = 0; i < nfts.length; i++) {
                if (nfts[i].selling_status === 0) {
                    if (
                        checkTimeCurrent(nfts[i].start_date, current_time, nfts[i].end_date) ===
                        true
                    ) {
                        errorNftIds.push(nfts[i].id);
                    }
                    if (
                        checkTimeCurrent(nfts[i].start_date, current_time, nfts[i].end_date) ===
                        false
                    ) {
                        sellingStatusSellArr.push(nfts[i].id);
                    }
                }
                if (nfts[i].selling_status === 1) {
                    sellingStatusStopArr.push(nfts[i].id);
                }
            }

            if (errorNftIds.length > 0) {
                return handlerError(
                    req,
                    res,
                    `Nft ids "${errorNftIds.join(', ')}" is not allow to update!`,
                );
            }

            // check start_date
            if (sellingStatusSellArr.length > 0) {
                let startDate = new Date(convertTimezone(data.start_date).setSeconds(0, 0));
                input.start_date = startDate;
                // if (startDate > current_time) {
                // } else {
                //     return handlerError(req, res, ErrorMessage.START_DATE_IS_INVALID);
                // }

                // check end_date
                let endDate = null;
                if (data.end_date) {
                    endDate = new Date(convertTimezone(data.end_date).setSeconds(0, 0));
                    if (endDate > startDate) {
                        // if (endDate > current_time && endDate > startDate) {
                        input.end_date = endDate;
                    } else {
                        return handlerError(req, res, ErrorMessage.END_DATE_IS_INVALID);
                    }
                }

                const updateNft = await nftRepository.updateSchedule(sellingStatusSellArr, input);
                if (!updateNft) {
                    return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
                }
            }

            if (sellingStatusStopArr.length > 0) {
                const newStartDate = req.body.start_date;
                const newEndDate = req.body.end_date;

                data.start_date = new Date(convertTimezone(newStartDate).setSeconds(0, 0));

                if (new Date(newEndDate) > new Date(newStartDate)) {
                    data.end_date = new Date(convertTimezone(newEndDate).setSeconds(0, 0));
                } else {
                    return handlerError(req, res, ErrorMessage.END_DATE_IS_INVALID);
                }

                const updateNft = await nftRepository.updateSchedule(sellingStatusStopArr, data);
                if (!updateNft) {
                    return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
                }
            }

            return handlerSuccess(req, res, 'Update Nfts successed!');
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    //suspend nft
    async deleteNft(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const nft = await nftRepository.findById(req.params.id);

            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            if (nft.collection_id != null) {
                return handlerError(
                    req,
                    res,
                    'NFTs belonging to the collection cannot be deleted.',
                );
            }

            let serials = await serialRepository.findByNftId(nft._id);

            let status = [SERIAL_STATUS.ACTIVE, SERIAL_STATUS.INACTIVE];
            let serialIds = [];
            for (let i = 0; i < serials.length; i++) {
                if (serials[i].owner_id == null && status.includes(serials[i].status)) {
                    serialIds.push(serials[i]._id);
                }
            }

            let adminAddress = await adminRepository.getAdminAddress();

            const deleteSerial = await serialRepository.deleteMany(serialIds, adminAddress);

            if (deleteSerial) {
                const deleteNft = await nftRepository.delete(req.params.id, {
                    status: NFT_STATUS.SUSPEND,
                });
            }

            return handlerSuccess(req, res, {
                serial: deleteSerial,
            });
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async deleteManyNft(req, res, next) {
        try {
            const nft_ids = req.body.nft_ids;

            nft_ids.forEach((item) => {
                if (ObjectID.isValid(item) === false) {
                    return handlerError(req, res, `Id '${item}' is not ObjectId`);
                }
            });

            const errorIds = await checkExistedDocument(nftRepository, nft_ids);
            if (errorIds.length > 0) {
                return handlerError(req, res, `Ids '${errorIds.join(', ')}' is not found!`);
            }

            // check NFT belongs to a collection

            let nftChecking = await nftRepository.count({
                _id: {$in: nft_ids},
                collection_id: {$ne: null},
            });

            if (nftChecking > 0) {
                return handlerError(
                    req,
                    res,
                    'NFTs belonging to the collection cannot be deleted.',
                );
            }

            let adminAddress = await adminRepository.getAdminAddress();

            const deleteNfs = await nftRepository.deleteMany(nft_ids, adminAddress);

            if (!deleteNfs) {
                return handlerError(req, res, 'Delete many nfts are not successed');
            }
            return handlerSuccess(req, res, {serial: deleteNfs});
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

function getFindParams(filters) {
    let findParams = {};

    if (filters.status) {
        findParams.status = filters.status;
    }

    if (typeof filters.selling_status !== 'undefined') {
        findParams.selling_status = filters.selling_status;
    }

    if (filters.type) {
        findParams.type = filters.type;
    }

    if (filters.category) {
        findParams.category = filters.category;
    }

    const findByName = Object.assign({}, findParams);
    const findByDesc = Object.assign({}, findParams);
    const findByMetadataName = Object.assign({}, findParams);
    const findByCompanyId = Object.assign({}, findParams);
    const findByCollectionId = Object.assign({}, findParams);

    if (filters.keyword) {
        findByName.name = addMongooseParam(
            findByName.name,
            '$regex',
            new RegExp(filters.keyword, 'i'),
        );

        findByMetadataName['metadata.name'] = addMongooseParam(
            findByMetadataName['metadata.name'],
            '$regex',
            new RegExp(filters.keyword, 'i'),
        );

        findByDesc.description = addMongooseParam(
            findByDesc.description,
            '$regex',
            new RegExp(filters.keyword, 'i'),
        );

        if (ObjectID.isValid(filters.keyword) === true) {
            findByCompanyId.company_id = addMongooseParam(
                findByCompanyId.company_id,
                '$eq',
                filters.keyword,
            );

            findByCollectionId.collection_id = addMongooseParam(
                findByCollectionId.collection_id,
                '$eq',
                filters.keyword,
            );
        }
    }

    const searchParams = {
        $or: [findByName, findByDesc, findByMetadataName],
    };

    if (ObjectID.isValid(filters.keyword) === true) {
        searchParams['$or'].push(findByCompanyId, findByCollectionId);
    }

    return searchParams;
}

function getUpdateBodys(updates) {
    let updateBodys = {};

    if (updates.quantity) {
        updateBodys.quantity = updates.quantity;
    }

    if (updates.description) {
        updateBodys.description = updates.description;
    }

    if (updates.status) {
        updateBodys.status = updates.status;
    }

    if (updates.price) {
        updateBodys.price = updates.price;
    }

    if (updates.collection_id) {
        updateBodys.collection_id = updates.collection_id;
    }

    if (updates.company_id) {
        updateBodys.company_id = updates.company_id;
    }

    if (typeof updates.selling_status !== 'undefined') {
        updateBodys.selling_status = updates.selling_status;
    }

    if (updates.start_date) {
        updateBodys.start_date = updates.start_date;
    }

    if (updates.end_date) {
        updateBodys.end_date = updates.end_date;
    }

    if (!isEmptyObject(updateBodys)) {
        updateBodys.updatedAt = Date.now();
    }

    return updateBodys;
}
function getUpdateScheduleBodys(updates) {
    let updateBodys = {};

    if (updates.start_date) {
        updateBodys.start_date = updates.start_date;
    }

    if (updates.end_date) {
        updateBodys.end_date = updates.end_date;
    }

    if (!isEmptyObject(updateBodys)) {
        updateBodys.updatedAt = Date.now();
    }

    return updateBodys;
}

function convertProductResponse(products) {
    const current_time = new Date();
    const productsRes = [];
    products.forEach((element) => {
        let item = Object.assign({}, element._doc);
        if (element.quantity_selling > 0) {
            if (element.selling_status === 0) {
                if (checkTimeCurrent(element.start_date, current_time, element.end_date) === true) {
                    productsRes.push({
                        ...item,
                        selling: true,
                    });
                }

                if (
                    checkTimeCurrent(element.start_date, current_time, element.end_date) === false
                ) {
                    productsRes.push({
                        ...item,
                        selling: false,
                    });
                }
            }
            if (element.selling_status === 1) {
                productsRes.push({
                    ...item,
                    selling: false,
                });
            }
        } else {
            productsRes.push({
                ...item,
                selling: false,
            });
        }
    });

    return productsRes;
}

function validateCreateNft(req, res) {
    let err = [];
    if (!req.body.name || req.body.name.length === 0) {
        err.push('Missing name parameter');
        return err;
    }

    if (!req.body.quantity || req.body.quantity.length === 0) {
        err.push('Missing quantity parameter');
        return err;
    }

    if (!req.body.description || req.body.description.length === 0) {
        err.push('Missing description parameter');
        return err;
    }

    if (!req.body.company_id || req.body.company_id.length === 0) {
        err.push('Missing company_id parameter');
        return err;
    }

    if (!req.body.rarity || req.body.rarity.length === 0) {
        err.push('Missing rarity parameter');
        return err;
    }

    if (req.body.type * 1 === NFT_TYPE.NORMAL) {
        if (!req.body.category || req.body.category.length === 0) {
            err.push('Missing category parameter');
            return err;
        }

        if (!req.body.price) {
            err.push('Missing price parameter');
            return err;
        } else if (req.body.price * 1 <= 0) {
            err.push('price has invalid value');
            return err;
        }
    }

    return false;
}
