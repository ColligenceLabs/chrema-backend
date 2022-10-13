const _ = require('lodash');
const sleep = require('sleep');
const {validationResult} = require('express-validator');
const logger = require('../../utils/logger');
var ObjectID = require('mongodb').ObjectID;

const nftRepository = require('../../repositories/nft_repository');
const adminRepository = require('../../repositories/admin_repository');
const serialRepository = require('../../repositories/serial_repository');
const nftBlockchain = require('../blockchain/nft_controller');
const listenerRepository = require('../../repositories/listener_repository');
const collectionRepository = require('../../repositories/collection_repository');
const consts = require('../../utils/consts');
const quoteTokens = require('../../utils/quoteTokens');
const fs = require('fs');
const BigNumber = require('bignumber.js');

const {
    _errorFormatter,
    addMongooseParam,
    getHeaders,
    checkExistedDocument,
    isEmptyObject,
    checkTimeCurrent,
    convertTimezone,
    getCoinPrice,
    getExchange,
    getChainId,
    getQuote,
    writeJson,
    imageMove,
} = require('../../utils/helper');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {
    NFT_STATUS,
    NFT_TYPE,
    SERIAL_STATUS,
    IPFS_URL,
    ALT_URL,
    SELLING_STATUS,
    TRANSFERED,
} = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
const historyRepository = require('../../repositories/history_repository');
const txRepository = require('../../repositories/transaction_repository');
const {getMarketAddress} = require('../../utils/getMarketAddress');
const {createVault} = require("../../utils/steganography");

module.exports = {
    classname: 'NftController',

    // createNft 순서 : 1. 파일업로드 (db, ipfs업로드  -> 파일명 해시값으로변경 -> 이미지일경우 리사이즈, 원본과 리사이즈 모두 저장한다)
    //                 2. json 업로드 (db, ipfs)
    //                 3. db저장
    //                 4. 민팅
    // TODOS: 대량의 민트 (2000개 이상)를 안정적으로 하는 로직 만들기
    // TODOS: category 추가하기 (배열로)

    // Minting NFTs via KAS API
    createNftBatch: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            let admin_address = req.body.admin_address;

            let collection = await collectionRepository.findById(req.body.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            //upload file
            // await uploadRepository(req, res);
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
            // await imageRename(consts.UPLOAD_PATH + imgInput, consts.UPLOAD_PATH + renameOutput);
            const targetDir = `./uploads/${collection.contract_address}/`;
            await imageMove(consts.UPLOAD_PATH + imgInput,  targetDir + renameOutput);

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
                // await imageRename(consts.UPLOAD_PATH + thumbnailInput, consts.UPLOAD_PATH + 'thumbnail/' + thumbnailOutput);
                await imageMove(consts.UPLOAD_PATH + thumbnailInput, targetDir + 'thumbnail/' + thumbnailOutput);
            }

            // TODO : nftRepository.getItemList() - made by James - 를 알 수가 없음.
            // //get all nft from blockchain service
            // let itemList = await nftRepository.getItemList();
            // //sort with value
            // itemList.items.sort(function (a, b) {
            //     return (
            //         parseInt(b.tokenId.replace('0x', ''), 16) -
            //         parseInt(a.tokenId.replace('0x', ''), 16)
            //     );
            // });
            // get last tokenId in db
            // let lastTokenId = await listenerRepository.findLastTokenId();
            const lastNft = await nftRepository.findLastNft(collection._id);
            let tokenId = 0;
            if (lastNft.length > 0) {
                tokenId = parseInt(lastNft[0].metadata.tokenId);
            }
            console.log('=======>', lastNft, tokenId);

            let creator = await adminRepository.findById(collection.creator_id);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            //check contract
            // TODO: 2021.12.28 추후 수정할 수 도 있음. 지금은 DB에 직접 contract를 추가하도록 한다.
            // let contract = await contractRepository.findByContractAddress(process.env.NFT_CONTRACT_ADDR);
            // let contractId = new ObjectID(contract._id);

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
            let category;
            if (req.body.category)
                category = req.body.category.split(',');

            const attributes = req.body.attributes ? JSON.parse(req.body.attributes) : [];

            for (let i = 0; i < quantity; i++) {
                // 수량에 맞춰 newNft를 만들고 newNfts배열에 저장
                let newNft = {
                    metadata: {
                        name: req.body.name,
                        description: req.body.description,
                        image: IPFS_URL + result.Hash,
                        alt_url: ALT_URL + collection.contract_address + '/' + result.Hash + '.' + imgName[imgName.length -1],
                        content_Type: imgName[imgName.length -1],
                        cid: result.Hash,
                        tokenId: decimalTokenIds[i],
                        total_minted: "",
                        external_url: req.body.external_url,
                        attributes: attributes,
                        minted_by: process.env.MINTED_BY ?? "Talken",
                        thumbnail: "",
                        creator_name: creator.name,
                        creator_icon: creator.image,
                        category: [],
                    },
                    // company_id: req.body.company_id,
                    collection_id: req.body.collection_id,
                    creator_id: creator._id,
                    type: req.body.type * 1,
                    ...(req.body?.price && {price: req.body.price}),
                    ...(req.body?.quote && {quote: req.body.quote}),
                    ...(req.body?.quantity && {quantity: req.body.quantity}),
                    ...(req.body?.quantity && {quantity_selling: 0}),
                    ...(req.body?.start_date && {start_date: req.body.start_date}),
                    ...(req.body?.end_date && {end_date: req.body.end_date}),
                    ...(req.body?.status && {status: req.body.status}),
                    // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                    // ...(req.body?.category && {category: req.body.category}),
                    ...(req.body?.category && {category}),
                    ...(req.body?.description && {description: req.body.description}),
                    ...(req.body?.rarity && {rarity: req.body.rarity}),
                    // contract_id: contractId,
                    transfered: 0
                };

                let metadata_ipfs = newNft.metadata;
                if (req.body.category) {
                    // metadata_ipfs.category = JSON.parse(req.body.category);
                    // newNft.metadata.category = JSON.parse(req.body.category);
                    // metadata_ipfs.category = req.body.category;
                    // newNft.metadata.category = req.body.category;
                    metadata_ipfs.category = category;
                    newNft.metadata.category = category;
                }
                if (req.body.quantity) {
                    // metadata_ipfs.total_minted = JSON.parse(req.body.quantity);
                    metadata_ipfs.total_minted = req.body.quantity;
                }

                //thumbnail check
                if (typeof req.files.thumbnail != 'undefined') {
                    metadata_ipfs.thumbnail = ALT_URL + `${collection.contract_address}/thumbnail/` + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
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
                newNft.metadata_link = ALT_URL + '/nfts/metadata/' + metadata_ipfs_link.Hash + '.json';

                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }

                // write json file
                await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadata_ipfs), i+1);

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
                    contract_address: collection.contract_address
                };

                if (newNft.type === 1) {
                    newNft.price = 0;
                }
                newNfts.push(newNft);
                newSerials.push(newSerial);
            }

            let nft = await nftRepository.create(newNfts[0], newSerials[0], tokenIds, ipfs_links);

            if (!nft) {
                return handlerError(req, res, ErrorMessage.CREATE_NFT_IS_NOT_SUCCESS);
            }
            for (let i = 0; i < tokenIds.length; i++) {
                let to = admin_address;
                let newTokenId = tokenIds[i];
                let tokenUri = ipfs_links[i];
                // mint nft
                // let mintResult = await nftBlockchain._mint(to, newTokenId, tokenUri);
                let mintResult = await nftBlockchain._mint17(collection.contract_address, to, newTokenId, tokenUri);
                if (mintResult.status !== 200 && mintResult.error._code !== 1104400) {
                    // return handlerError(req, res, {error: mintResult.error});
                    console.log('====>', mintResult.error);
                    sleep.sleep(3);
                    i = i - 1;
                    continue;
                }
            }

            await nftRepository.update(nft._id, {onchain: 'true'});

            return handlerSuccess(req, res, nft);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    getLastNftID: async (req, res, next) => {
        if (ObjectID.isValid(req.params.id) === false) {
            return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
        }

        try {
            const lastNft = await nftRepository.findLastNft(req.params.id);
            let tokenId = 0;
            if (lastNft.length > 0) {
                tokenId = parseInt(lastNft[0].metadata.tokenId);
                return handlerSuccess(req, res, {tokenId});
            } else {
                return handlerSuccess(req, res, {tokenId});
                // return handlerError(req, res, ErrorMessage.FAIL_TO_GET_LAST_TOKENID);
            }
        } catch (error) {
            logger.error(new Error(error));
            // next(error);
            return handlerError(req, res, ErrorMessage.FAIL_TO_GET_LAST_TOKENID);
        }
    },

    getTokenFromChain: async (req, res, next) => {
        const contract = req.body.contract_address;
        const tokenId = req.body.tokenId;

        if (contract == '' || contract == undefined || contract == null) {
            return handlerError(req, res, ErrorMessage.PARAMETERS_INVALID);
        }
        if (tokenId == '' || tokenId == undefined || tokenId == null) {
            return handlerError(req, res, ErrorMessage.PARAMETERS_INVALID);
        }

        try {
            let token = await nftBlockchain._getToken(contract, tokenId);
            console.log('===>', token)
            if (token) {
                return handlerSuccess(req, res, {token});
            } else {
                return handlerError(req, res, ErrorMessage.NOT_ON_CHAIN);
            }
        } catch (error) {
            logger.error(new Error(error));
            // next(error);
            return handlerError(req, res, ErrorMessage.FAIL_TO_GET_TOKEN);
        }
    },

    async getTokenFromDB(req, res, next) {
        const id = req.body.collection_id;
        const tokenId = req.body.tokenId;

        try {
            if (ObjectID.isValid(id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            let collection = await collectionRepository.findById(id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            const nft = await nftRepository.findNftByFilter({collection_id: id, 'metadata.tokenId': tokenId});
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const txHashs = [];
            if (nft.onchain === 'true') {

                let event = await listenerRepository.findByNftTokenId(nft._id, tokenId);
                if (!event) {
                    return handlerError(req, res, ErrorMessage.TX_IS_NOT_FOUND);
                }
                txHashs.push(event.tx_id);
            }

            return handlerSuccess(req, res, {...nft._doc, txHashs});
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    // Minting NFTs via KAS API
    // Caution : Use same ipfs metadata hash link
    createNftBatchNew: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            let admin_address = req.body.admin_address;
            let to_address = req.body.to_address;

            let collection = await collectionRepository.findById(req.body.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            //upload file
            // await uploadRepository(req, res);
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
            // await imageRename(consts.UPLOAD_PATH + imgInput, consts.UPLOAD_PATH + renameOutput);
            const targetDir = `./uploads/${collection.contract_address}/`;
            await imageMove(consts.UPLOAD_PATH + imgInput,  targetDir + renameOutput);

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
                // await imageRename(consts.UPLOAD_PATH + thumbnailInput, consts.UPLOAD_PATH + 'thumbnail/' + thumbnailOutput);
                await imageMove(consts.UPLOAD_PATH + thumbnailInput, targetDir + 'thumbnail/' + thumbnailOutput);
            }

            // 토큰 중복 문제로 인해 마지막 토큰 ID 구하는 로직 변경. (생성이 실패할 경우 tokenId 가 누락될 수 있다. - 2022.06.10)
            // let lastTokenId = await listenerRepository.findLastTokenOfAddress(collection.contract_address);
            let tokenId = 0;

            if (req.body.tokenId) {
                tokenId = parseInt(req.body.tokenId);
            } else {
                let lastNft;
                lastNft = await nftRepository.findLastNft(collection._id);

                if (lastNft.length > 0) {
                    tokenId = parseInt(lastNft[0].metadata.tokenId);
                }
            }
            // console.log('=======>', lastTokenId, tokenId)

            let creator = await adminRepository.findById(collection.creator_id);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            //check contract
            // TODO: 2021.12.28 추후 수정할 수 도 있음. 지금은 DB에 직접 contract를 추가하도록 한다.
            // let contract = await contractRepository.findByContractAddress(process.env.NFT_CONTRACT_ADDR);
            // let contractId = new ObjectID(contract._id);

            let quantity = req.body.quantity;
            let tokenIds = [];
            let decimalTokenIds = [];
            let newNfts = [];
            let newSerials = [];
            let ipfs_links = [];
            let metadata_ipfs_link;

            for (let i = 0; i < quantity; i++) {
                let newTokenId;
                if (req.body.tokenId) {
                    newTokenId = tokenId + i;
                } else {
                    newTokenId = tokenId + 1 + i;
                }
                tokenIds.push('0x' + newTokenId.toString(16));
                decimalTokenIds.push(newTokenId.toString());
            }
            //nft default
            let category;
            if (req.body.category)
                category = req.body.category.split(',');

            const attributes = req.body.attributes ? JSON.parse(req.body.attributes) : [];

            for (let i = 0; i < quantity; i++) {
                // console.log('----->', i)
                // console.log('----->', attributes)
                // 수량에 맞춰 newNft를 만들고 newNfts배열에 저장
                let newNft = {
                    metadata: {
                        name: req.body.name,
                        description: req.body.description,
                        image: IPFS_URL + result.Hash,
                        // alt_url: ALT_URL + result.Hash + '.' + imgName[imgName.length -1],
                        alt_url: ALT_URL + collection.contract_address + '/' + result.Hash + '.' + imgName[imgName.length -1],
                        content_Type: imgName[imgName.length -1],
                        cid: result.Hash,
                        tokenId: decimalTokenIds[i],
                        total_minted: "",
                        external_url: req.body.external_url,
                        // attributes: [],
                        attributes: attributes,
                        minted_by: process.env.MINTED_BY ?? "Talken",
                        thumbnail: "",
                        creator_name: creator.name,
                        creator_icon: creator.image,
                        category: [],
                    },
                    // company_id: req.body.company_id,
                    collection_id: req.body.collection_id,
                    creator_id: creator._id,
                    type: req.body.type * 1,
                    ...(req.body?.price && {price: req.body.price}),
                    ...(req.body?.quote && {quote: req.body.quote}),
                    ...(req.body?.quantity && {quantity: req.body.quantity}),
                    ...(req.body?.quantity && {quantity_selling: 0}),
                    ...(req.body?.start_date && {start_date: req.body.start_date}),
                    ...(req.body?.end_date && {end_date: req.body.end_date}),
                    ...(req.body?.status && {status: req.body.status}),
                    // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                    // ...(req.body?.category && {category: req.body.category}),
                    ...(req.body?.category && {category}),
                    ...(req.body?.description && {description: req.body.description}),
                    ...(req.body?.rarity && {rarity: req.body.rarity}),
                    // contract_id: contractId,
                    transfered: 0
                };
                let metadata_ipfs = newNft.metadata;
                if (req.body.category) {
                    // metadata_ipfs.category = JSON.parse(req.body.category);
                    // newNft.metadata.category = JSON.parse(req.body.category);
                    // metadata_ipfs.category = req.body.category;
                    // newNft.metadata.category = req.body.category;
                    metadata_ipfs.category = category;
                    newNft.metadata.category = category;
                }
                if (req.body.quantity) {
                    // metadata_ipfs.total_minted = JSON.parse(req.body.quantity);
                    metadata_ipfs.total_minted = req.body.quantity;
                }
                //thumbnail check
                if (typeof req.files.thumbnail != 'undefined') {
                    metadata_ipfs.thumbnail = ALT_URL + `${collection.contract_address}/thumbnail/` + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
                }
                // let metadata_ipfs_link;
                if (i === 0) {
                    const ipfsMetadata = _.omit(metadata_ipfs, 'tokenId');
                    metadata_ipfs_link = await nftRepository.addJsonToIPFS(ipfsMetadata);
                    console.log('--->', metadata_ipfs_link)
                }
                // remove ipfs links array from metadata
                // let ipfs_link_item = {
                //     tokenId: decimalTokenIds[i],
                //     path: IPFS_URL + metadata_ipfs_link.Hash
                // }
                // ipfs_links.push(ipfs_link_item);
                // newNft.ipfs_links = ipfs_links;
                ipfs_links.push(IPFS_URL + metadata_ipfs_link.Hash)
                newNft.ipfs_link = IPFS_URL + metadata_ipfs_link.Hash;
                newNft.metadata_link = ALT_URL + '/nfts/metadata/' + metadata_ipfs_link.Hash + '.json';
                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }

                // write json file
                await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadata_ipfs), i+1);
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
                    contract_address: collection.contract_address
                };

                if (newNft.type === 1) {
                    newNft.price = 0;
                }
                newNfts.push(newNft);
                newSerials.push(newSerial);
            }

            let nft = await nftRepository.create(newNfts[0], newSerials[0], tokenIds, ipfs_links);
            // let [nft, error] = await nftRepository.createWithError(newNfts[0], newSerials[0], tokenIds, ipfs_links);

            if (!nft) {
            // if (!nft && error) {
                return handlerError(req, res, ErrorMessage.CREATE_NFT_IS_NOT_SUCCESS);
                // return handlerError(req, res, error);
            }
            let txHashs = [];
            for (let i = 0; i < tokenIds.length; i++) {
                let to = to_address ?? admin_address;
                let newTokenId = tokenIds[i];
                let tokenUri = ipfs_links[i];
                // mint nft
                // let mintResult = await nftBlockchain._mint(to, newTokenId, tokenUri);
                let mintResult = await nftBlockchain._mint17(collection.contract_address, to, newTokenId, tokenUri);
                console.log('---- mint result ------->', mintResult)
                // if (mintResult.status !== 200 && mintResult.error._code !== 1104400) {
                //     // return handlerError(req, res, {error: mintResult.error});
                //     console.log('====>', mintResult.error);
                //     sleep.sleep(3);
                //     i = i - 1;
                //     continue;
                // } else
                if (mintResult.status !== 200) {
                    const errMsg = 'KAS Error : ' + mintResult.error._message + ' : ' +  newTokenId;
                    return handlerError(req, res, errMsg);
                } else if (mintResult.status === 200) {
                    txHashs.push(mintResult.result.transactionHash);
                }
            }

            await nftRepository.update(nft._id, {onchain: 'true'});

            return handlerSuccess(req, res, {...nft._doc, txHashs});
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    // Minting NFTs via KAS API
    // Caution : Use same ipfs metadata hash link
    recreateNftBatchNew: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            let admin_address = req.body.admin_address;
            let to_address = req.body.to_address;

            let collection = await collectionRepository.findById(req.body.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            // //upload file
            // // await uploadRepository(req, res);
            // let my_file = req.files.file[0];
            //
            // errors = validateCreateNft(req, res);
            // if (errors) {
            //     return handlerError(req, res, errors[0]);
            // }
            //
            // let result = await nftRepository.addFileToIPFS(my_file);
            // let imgName = my_file.filename.split('.');
            // let imgInput = my_file.filename;
            //
            // let renameOutput = result.Hash + '.' + imgName[imgName.length -1];
            // let imgOutput = result.Hash + '_resize.' + imgName[imgName.length -1];
            //
            // //rename
            // // await imageRename(consts.UPLOAD_PATH + imgInput, consts.UPLOAD_PATH + renameOutput);
            // const targetDir = `./uploads/${collection.contract_address}/`;
            // await imageMove(consts.UPLOAD_PATH + imgInput,  targetDir + renameOutput);
            //
            // // //resize
            // // if (imgName[imgName.length -1].toLowerCase() === 'jpg'| imgName[imgName.length -1].toLowerCase() === 'png' | imgName[imgName.length -1].toLowerCase() === 'jpeg')
            // await imageResize('./uploads/' + renameOutput, './uploads/' + imgOutput);

            // //thumbnail check
            // let thumbName = null;
            // if (typeof req.files.thumbnail != 'undefined') {
            //     let my_thumbnail = req.files.thumbnail[0];
            //     thumbName = my_thumbnail.filename.split('.');
            //     let thumbnailInput = my_thumbnail.filename;
            //     let thumbnailOutput = result.Hash + '_thumbnail.' + thumbName[thumbName.length -1];
            //     // await imageRename(consts.UPLOAD_PATH + thumbnailInput, consts.UPLOAD_PATH + 'thumbnail/' + thumbnailOutput);
            //     await imageMove(consts.UPLOAD_PATH + thumbnailInput, targetDir + 'thumbnail/' + thumbnailOutput);
            // }

            // 토큰 중복 문제로 인해 마지막 토큰 ID 구하는 로직 변경. (생성이 실패할 경우 tokenId 가 누락될 수 있다. - 2022.06.10)
            // let lastTokenId = await listenerRepository.findLastTokenOfAddress(collection.contract_address);
            let tokenId = 0;

            if (req.body.tokenId) {
                tokenId = parseInt(req.body.tokenId);
            } else {
                let lastNft;
                lastNft = await nftRepository.findLastNft(collection._id);

                if (lastNft.length > 0) {
                    tokenId = parseInt(lastNft[0].metadata.tokenId);
                }
            }
            // console.log('=======>', lastTokenId, tokenId)

            let creator = await adminRepository.findById(collection.creator_id);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            //check contract
            // TODO: 2021.12.28 추후 수정할 수 도 있음. 지금은 DB에 직접 contract를 추가하도록 한다.
            // let contract = await contractRepository.findByContractAddress(process.env.NFT_CONTRACT_ADDR);
            // let contractId = new ObjectID(contract._id);

            let quantity = req.body.quantity;
            let tokenIds = [];
            let decimalTokenIds = [];
            let newNfts = [];
            let newSerials = [];
            let ipfs_links = [];
            let metadata_ipfs_link = req.body.ipfsLink;     // New

            const data1 = req.body.imageUrl.split('/');
            const imageHash = data1[data1.length - 1];
            const data2 = metadata_ipfs_link.split('/');
            const ipfsHash = data2[data2.length - 1];


            for (let i = 0; i < quantity; i++) {
                let newTokenId;
                if (req.body.tokenId) {
                    newTokenId = tokenId + i;
                } else {
                    newTokenId = tokenId + 1 + i;
                }
                tokenIds.push('0x' + newTokenId.toString(16));
                decimalTokenIds.push(newTokenId.toString());
            }
            //nft default
            let category;
            if (req.body.category)
                category = req.body.category.split(',');

            const attributes = req.body.attributes ? JSON.parse(req.body.attributes) : [];

            for (let i = 0; i < quantity; i++) {
                // console.log('----->', i)
                // console.log('----->', attributes)
                // 수량에 맞춰 newNft를 만들고 newNfts배열에 저장
                let newNft = {
                    metadata: {
                        name: req.body.name,
                        description: req.body.description,
                        // image: IPFS_URL + result.Hash,
                        image: req.body.imageUrl,   // New
                        // alt_url: ALT_URL + result.Hash + '.' + imgName[imgName.length -1],
                        // alt_url: ALT_URL + collection.contract_address + '/' + result.Hash + '.' + imgName[imgName.length -1],
                        alt_url: req.body.altUrl,   // New
                        // content_Type: imgName[imgName.length -1],
                        content_Type: "png",        // New
                        // cid: result.Hash,
                        cid: imageHash,         // New
                        tokenId: decimalTokenIds[i],
                        total_minted: "",
                        external_url: req.body.external_url,
                        // attributes: [],
                        attributes: attributes,
                        minted_by: process.env.MINTED_BY ?? "Talken",
                        thumbnail: "",
                        creator_name: creator.name,
                        creator_icon: creator.image,
                        category: [],
                    },
                    // company_id: req.body.company_id,
                    collection_id: req.body.collection_id,
                    creator_id: creator._id,
                    type: req.body.type * 1,
                    ...(req.body?.price && {price: req.body.price}),
                    ...(req.body?.quote && {quote: req.body.quote}),
                    ...(req.body?.quantity && {quantity: req.body.quantity}),
                    ...(req.body?.quantity && {quantity_selling: 0}),
                    ...(req.body?.start_date && {start_date: req.body.start_date}),
                    ...(req.body?.end_date && {end_date: req.body.end_date}),
                    ...(req.body?.status && {status: req.body.status}),
                    // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                    // ...(req.body?.category && {category: req.body.category}),
                    ...(req.body?.category && {category}),
                    ...(req.body?.description && {description: req.body.description}),
                    ...(req.body?.rarity && {rarity: req.body.rarity}),
                    // contract_id: contractId,
                    transfered: 0
                };
                let metadata_ipfs = newNft.metadata;
                if (req.body.category) {
                    // metadata_ipfs.category = JSON.parse(req.body.category);
                    // newNft.metadata.category = JSON.parse(req.body.category);
                    // metadata_ipfs.category = req.body.category;
                    // newNft.metadata.category = req.body.category;
                    metadata_ipfs.category = category;
                    newNft.metadata.category = category;
                }
                if (req.body.quantity) {
                    // metadata_ipfs.total_minted = JSON.parse(req.body.quantity);
                    metadata_ipfs.total_minted = req.body.quantity;
                }
                // //thumbnail check
                // if (typeof req.files.thumbnail != 'undefined') {
                //     metadata_ipfs.thumbnail = ALT_URL + `${collection.contract_address}/thumbnail/` + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
                // }
                metadata_ipfs.thumbnail = req.body.thumbnail;       // New
                // let metadata_ipfs_link;
                // if (i === 0) {
                //     const ipfsMetadata = _.omit(metadata_ipfs, 'tokenId');
                //     metadata_ipfs_link = await nftRepository.addJsonToIPFS(ipfsMetadata);
                //     console.log('--->', metadata_ipfs_link)
                // }

                // remove ipfs links array from metadata
                // let ipfs_link_item = {
                //     tokenId: decimalTokenIds[i],
                //     path: IPFS_URL + metadata_ipfs_link.Hash
                // }
                // ipfs_links.push(ipfs_link_item);
                // newNft.ipfs_links = ipfs_links;
                // ipfs_links.push(IPFS_URL + metadata_ipfs_link.Hash)
                // newNft.ipfs_link = IPFS_URL + metadata_ipfs_link.Hash;
                // newNft.metadata_link = ALT_URL + '/nfts/metadata/' + metadata_ipfs_link.Hash + '.json';
                ipfs_links.push(IPFS_URL + ipfsHash)
                newNft.ipfs_link = IPFS_URL + ipfsHash;
                newNft.metadata_link = ALT_URL + '/nfts/metadata/' + ipfsHash + '.json';
                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }

                // write json file
                // await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadata_ipfs), i+1);
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
                    contract_address: collection.contract_address
                };

                if (newNft.type === 1) {
                    newNft.price = 0;
                }
                newNfts.push(newNft);
                newSerials.push(newSerial);
            }

            let nft = await nftRepository.create(newNfts[0], newSerials[0], tokenIds, ipfs_links);
            // let [nft, error] = await nftRepository.createWithError(newNfts[0], newSerials[0], tokenIds, ipfs_links);

            if (!nft) {
                // if (!nft && error) {
                return handlerError(req, res, ErrorMessage.CREATE_NFT_IS_NOT_SUCCESS);
                // return handlerError(req, res, error);
            }
            let txHashs = [];
            for (let i = 0; i < tokenIds.length; i++) {
                let to = to_address ?? admin_address;
                let newTokenId = tokenIds[i];
                let tokenUri = ipfs_links[i];
                // mint nft
                // let mintResult = await nftBlockchain._mint(to, newTokenId, tokenUri);
                let mintResult = await nftBlockchain._mint17(collection.contract_address, to, newTokenId, tokenUri);
                console.log('---- mint result ------->', mintResult)
                // if (mintResult.status !== 200 && mintResult.error._code !== 1104400) {
                //     // return handlerError(req, res, {error: mintResult.error});
                //     console.log('====>', mintResult.error);
                //     sleep.sleep(3);
                //     i = i - 1;
                //     continue;
                // } else
                if (mintResult.status !== 200) {
                    const errMsg = 'KAS Error : ' + mintResult.error._message + ' : ' +  newTokenId;
                    return handlerError(req, res, errMsg);
                } else if (mintResult.status === 200) {
                    txHashs.push(mintResult.result.transactionHash);
                }
            }

            await nftRepository.update(nft._id, {onchain: 'true'});

            return handlerSuccess(req, res, {...nft._doc, txHashs});
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    deploy17: async (req, res, next) => {
        var errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }

        try {
            const name = req.body.name;
            const symbol = req.body.symbol;
            const alias = req.body.alias;
            const owner = process.env.CONTRACT_OWNER;

            let contract = await nftBlockchain._deploy17(name, symbol, alias, owner);

            return handlerSuccess(req, res, contract);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    kasTransferNft: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            let nft = await nftRepository.findById(req.body.nft_id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            let collection = await collectionRepository.findById(nft.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }
            let contract_address = collection.contract_address;

            let serials = await serialRepository.findByNftIdNotTRransfered(nft._id);
            if (!serials || serials.length === 0) {
                return handlerError(req, res, ErrorMessage.NO_NFT_IS_AVAILABLE);
            }

            // 어떤 걸 쓰는 게 맞을까?
            const serial = serials[0];
            // const serial = await serialRepository.findOneSerial({
            //     // _id: req.body.serial_id,
            //     _id: serials[0]._id,
            //     status: consts.SERIAL_STATUS.ACTIVE,
            //     // owner_id: user._id,
            //     owner_id: null,
            //     // nft_id: req.body.nft_id,
            //     nft_id: nft._id,
            //     transfered: consts.TRANSFERED.NOT_TRANSFER,
            // });

            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            const tx = await txRepository.createTx({
                serial_id: serial._id,
                seller: collection.creator_id,
                // buyer: user.id,
                buyer: req.body.to_address,
                price: nft.price,
                quote: nft.quote,
                status: consts.TRANSACTION_STATUS.PROCESSING,
            });

            // let from = req.body.from_address;
            let from = req.body.admin_address;
            let to = req.body.to_address;
            // let tokenId = req.body.tokenId;
            let tokenId = parseInt(serial.token_id, 16);
            let amount = req.body.amount;
            // transfer nft
            let transferResult
            if (collection.contract_type === 'KIP17') {
                transferResult = await nftBlockchain._transfer17(contract_address, from, to, tokenId);
            } else if (collection.contract_type === 'KIP37') {
                transferResult = await nftBlockchain._transfer37(contract_address, from, to, tokenId, amount);
            }

            // Update owner of serial
            if (transferResult.status === 200) {
                tx.tx_id = transferResult.result.transactionHash;
                tx.date = Date.now();
                tx.updatedAt = Date.now();
                await tx.save();

                // create new history
                let hs = JSON.parse(JSON.stringify(tx));
                hs.memo = consts.HISTORY_MEMO.WALLET_TRANSFER;
                hs.status = consts.TRANSACTION_STATUS.SUCCESS;
                await historyRepository.createTx(hs);

                // update db
                const newAmount = parseInt(nft.transfered, 10) + parseInt(amount, 10);
                await nftRepository.update(nft._id, {transfered: newAmount});
                await serialRepository.updateById(serial._id, {owner_id: tx.buyer});
                // 크롤러가 처리하는 듯...
                // await serialRepository.updateById(serial._id, {transfered: TRANSFERED.TRANSFERED});

                return handlerSuccess(req, res, {transaction: transferResult.result});
            }

            // Update status of transaction to ERROR
            if (transferResult.status !== 200) {
                tx.status = consts.TRANSACTION_STATUS.ERROR;
                tx.date = Date.now();
                tx.updatedAt = Date.now();
                await tx.save();

                // create new history
                let hs = JSON.parse(JSON.stringify(tx));
                hs.memo = consts.HISTORY_MEMO.TRANSFER_ERROR;
                await historyRepository.createTx(hs);

                return handlerError(req, res, {transaction: transferResult.error});
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    kasTransfer17: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            let contract_address = req.body.contract_address;
            // let from = req.body.from_address;
            let from = req.body.admin_address;
            let to = req.body.to_address;
            let tokenId = req.body.tokenId;
            // transfer nft
            let transferResult = await nftBlockchain._transfer17(contract_address, from, to, tokenId);

            // Update owner of serial
            if (transferResult.status === 200) {
                return handlerSuccess(req, res, {transaction: transferResult.result});
            }

            // Update status of transaction to ERROR
            if (transferResult.status !== 200) {
                return handlerError(req, res, {transaction: transferResult.error});
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    kasTransfer37: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            let contract_address = req.body.contract_address;
            // let from = req.body.from_address;
            let from = req.body.admin_address;
            let to = req.body.to_address;
            let tokenId = req.body.tokenId;
            let amount = req.body.amount;
            // transfer nft
            let transferResult = await nftBlockchain._transfer37(contract_address, from, to, tokenId, amount);

            // Update owner of serial
            if (transferResult.status === 200) {
                return handlerSuccess(req, res, {transaction: transferResult.result});
            }

            // Update status of transaction to ERROR
            if (transferResult.status !== 200) {
                return handlerError(req, res, {transaction: transferResult.error});
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    deploy37: async (req, res, next) => {
        var errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }

        try {
            const uri = req.body.uri;
            const alias = req.body.alias;

            let contract = await nftBlockchain._deploy37(uri, alias);

            return handlerSuccess(req, res, contract);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    mintNft: async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }
        let nft = await nftRepository.findById(req.params.id);
        if (!nft) {
            return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
        }
        // nft quantity 업데이트 후 serials 에 인서트
        if (parseInt(req.query.amount) === 0)
            return handlerError(req, res, ErrorMessage.MINT_AMOUNT_IS_ZERO);
        nft = await nftRepository.mintNFT(nft, req.query.amount);
        return handlerSuccess(req, res, nft);
    },

    burnNft17: async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }

        let collection = await collectionRepository.findById(req.body.collection_id);
        if (!collection) {
            return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
        }

        const burnResult = await nftBlockchain._burn17(collection.contract_address, req.body.owner, req.body.tokenId);
        if (burnResult.status !== 200) {
            return handlerError(req, res, burnResult.error._message);
        } else {
            return handlerSuccess(req, res, burnResult.result);
        }
    },

    // Minting NFTs via frontend Metamask
    createNft: async (req, res, next) => {
        try {
            let errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            let admin_address = req.body.admin_address;

            let tokenIds = [];
            let ipfs_links = [];
            let newNfts = [];

            //check collection
            let collection = await collectionRepository.findById(req.body.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            let my_file = req.files.file[0];

            errors = validateCreateNft(req, res);
            if (errors) {
                return handlerError(req, res, errors[0]);
            }

            let result = await nftRepository.addFileToIPFS(my_file);
            let imgName = my_file.originalname.split('.');
            let imgInput = my_file.filename;

            let renameOutput = result.Hash + '.' + imgName[imgName.length -1];
            // let imgOutput = result.Hash + '_resize.' + imgName[imgName.length -1];

            //rename
            const targetDir = `./uploads/${collection.contract_address}/`;
            await imageMove(consts.UPLOAD_PATH + imgInput,  targetDir + renameOutput);

            //resize
            // if (imgName[imgName.length -1].toLowerCase() === 'jpg'| imgName[imgName.length -1].toLowerCase() === 'png' | imgName[imgName.length -1].toLowerCase() === 'jpeg')
            // await imageResize('./uploads/' + renameOutput, './uploads/' + imgOutput);

            //thumbnail check
            let thumbName = null;
            if (typeof req.files.thumbnail != 'undefined') {
                let my_thumbnail = req.files.thumbnail[0];
                thumbName = my_thumbnail.filename.split('.');
                let thumbnailInput = my_thumbnail.filename;
                let thumbnailOutput = result.Hash + '_thumbnail.' + thumbName[thumbName.length -1];
                await imageMove(consts.UPLOAD_PATH + thumbnailInput, targetDir + 'thumbnail/' + thumbnailOutput);
            }

            // tokenId를 순차적으로 증가 시키기 위해서 정보를 가지고 옴.
            //get all nft from blockchain service
            // let itemList = await nftRepository.getItemList();
            // //sort with value
            // itemList.items.sort(function (a, b) {
            //     return (
            //         parseInt(b.tokenId.replace('0x', ''), 16) -
            //         parseInt(a.tokenId.replace('0x', ''), 16)
            //     );
            // });
            // // get last tokenId in db
            // let lastTokenId = await listenerRepository.findLastTokenId();
            // let tokenIdBlockchain = itemList.items.length === 0 ? "1000" : itemList.items[0].tokenId;
            // let tokenId = parseInt(tokenIdBlockchain.replace('0x', ''), 16);
            // if (lastTokenId && lastTokenId.length !== 0) {
            //     if (tokenId < lastTokenId[0].token_id) {
            //         tokenId = parseInt(lastTokenId[0].token_id);
            //     }
            // }

            // get creator
            let creator = await adminRepository.findById(collection.creator_id, null);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            let lastNft = await nftRepository.findAllOnchainNftsByCollectionId(req.body.collection_id);
            let newTokenId = 1;
            if (lastNft.length > 0) {
                newTokenId = parseInt(lastNft[0].metadata.tokenId) + 1;
            }
            tokenIds.push('0x' + newTokenId.toString(16));

            let category;
            if (req.body.category)
                category = req.body.category.split(',');

            const attributes = req.body.attributes ? JSON.parse(req.body.attributes) : [];

            //nft default
            let newNft = {
                metadata: {
                    name: req.body.name,
                    description: req.body.description,
                    image: IPFS_URL + result.Hash,
                    // alt_url: ALT_URL + result.Hash + '.' + imgName[imgName.length -1],
                    alt_url: ALT_URL + collection.contract_address + '/' + result.Hash + '.' + imgName[imgName.length -1],
                    content_Type: imgName[imgName.length -1],
                    cid: result.Hash,
                    tokenId: newTokenId.toString(),
                    total_minted: "",
                    external_url: req.body.external_url,
                    attributes: attributes,
                    minted_by: creator.full_name,
                    // thumbnail: ALT_URL + my_thumbnail.path,
                    thumbnail: "",
                    creator_name: creator.full_name,
                    creator_icon: creator.image,
                    category: [],
                    // category: req.body.category.toString(),
                },
                // company_id: req.body.company_id,
                collection_id: req.body.collection_id,
                creator_id: creator._id,
                type: req.body.type * 1,
                contract_type: req.body.contract_type,
                onchain: "false",
                ...(req.body?.price && {price: req.body.price}),
                ...(req.body?.quote && {quote: req.body.quote}),
                ...(req.body?.quote && {last_quote: req.body.quote}),
                ...(req.body?.quote && {floor_quote: req.body.quote}),
                ...(req.body?.quantity && {quantity: req.body.quantity}),
                ...(req.body?.quantity && {quantity_selling: 0}),
                ...(req.body?.start_date && {start_date: req.body.start_date}),
                ...(req.body?.end_date && {end_date: req.body.end_date}),
                ...(req.body?.status && {status: req.body.status}),
                // ...(req.body?.category && {category: req.body.category}),
                ...(req.body?.category && {category}),
                ...(req.body?.description && {description: req.body.description}),
                // ...(req.body?.rarity && {rarity: req.body.rarity}),
                // contract_id: contractId,
                transfered: 0
            };

            const coinPrice = await getCoinPrice();
            if (newNft.quote !== 'krw')
                newNft.sort_price = (new BigNumber(newNft.price)).multipliedBy(coinPrice[newNft.quote].USD).toNumber();
            else {
                const usd = await getExchange();
                newNft.sort_price = (new BigNumber(newNft.price)).dividedBy(new BigNumber(usd.data[0].basePrice)).toNumber();
            }

            let metadata_ipfs = newNft.metadata;

            if (req.body.category) {
                // metadata_ipfs.category = req.body.category;
                // newNft.metadata.category = req.body.category;
                metadata_ipfs.category = category;
                newNft.metadata.category = category;
            }
            if (req.body.quantity) {
                metadata_ipfs.total_minted = req.body.quantity;
            }

            //thumbnail check
            if (typeof req.files.thumbnail != 'undefined') {
                metadata_ipfs.thumbnail = ALT_URL + `${collection.contract_address}/thumbnail/` + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
            }

            // >>>>>>>>
            const cnt = parseInt((req.body.batch !== undefined && req.body.batch !== '') ? req.body.batch : '1');
            for (let i = 0; i < cnt; i++) {
                let tId = newTokenId + i;
                metadata_ipfs.tokenId = tId;
                if (collection.contract_type === 'KIP17') {
                    metadata_ipfs.name = req.body.name + ' #' + tId;
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
                if (collection.contract_type === 'KIP17') {
                    newNft.metadata_link = ALT_URL + '/nfts/metadata/' + metadata_ipfs_link.Hash + '.json';
                } else {
                    // ERC-1155
                    try {
                        if (fs.existsSync(`./uploads/nfts/metadata/${collection.directory}`) === false) {
                            console.log("Create metadata directory...");
                            await fs.mkdir(`./uploads/nfts/metadata/${collection.directory}`, {recursive: true}, (err) => {
                                if (err) throw err;
                            });
                        }
                    } catch (e) {
                        console.log("Error accessing metadata directory...")
                    }

                    newNft.metadata_link = ALT_URL + `/nfts/metadata/${collection.directory}` + '/0x' + tId.toString(16) + '.json';
                }

                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }

                let metadataForIpfs = {...metadata_ipfs};
                delete metadataForIpfs.tokenId;

                // write json file
                if (collection.contract_type === 'KIP17') {
                    await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadataForIpfs), 1);
                } else {
                    await writeJson(consts.UPLOAD_PATH + `metadata/${collection.directory}` + '/0x' + tId.toString(16) + ".json", JSON.stringify(metadataForIpfs), 1);
                }

                // TODO : What and why ?
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

                if (newNft.type === 1) {
                    newNft.price = 0;
                }

                let tempNft = {...newNft};
                newNfts.push(tempNft);
            }

            //serial default
            const newSerial = {
                type: req.body.type,
                ...(req.body?.status && {status: req.body.status}),
                contract_address: collection.contract_address.toLowerCase()
            };

            // let nft = await nftRepository.create(newNft, newSerial, tokenIds, ipfs_links);
            let nft;
            let ret = {nftIds: [], tokenIds: [], quantities: [], tokenUris: []};

            let tokenId;
            for (let i = 0; i < cnt; i++) {
                tokenId = '0x' + (newTokenId + i).toString(16);
                newNfts[i].metadata.tokenId = (newTokenId + i).toString();
                newNfts[i].metadata.name = req.body.name + ' #' + (newTokenId + i).toString();
                console.log('--->', newNfts[i], newSerial, tokenId, ipfs_links[i], collection.creator_id.admin_address);
                nft = await nftRepository.createByWallet(newNfts[i], newSerial, tokenId, ipfs_links[i], collection.creator_id.admin_address, collection.contract_type);
                ret.nftIds.push(nft._id);
                ret.tokenIds.push(newTokenId + i);
                ret.quantities.push(nft.quantity);
                ret.tokenUris.push(nft.ipfs_link);
            }

            if (!nft) {
                return handlerError(req, res, ErrorMessage.CREATE_NFT_IS_NOT_SUCCESS);
            }

            if (req.body.auto === 'true') {
                let to = creator.admin_address;
                let tokenUri = newNft.ipfs_link;
                // mint nft
                let mintResult
                if (collection.contract_type === 'KIP17') {
                    mintResult = await nftBlockchain._mint17(collection.contract_address, to, newTokenId, tokenUri);
                } else if (collection.contract_type === 'KIP37') {
                    mintResult = await nftBlockchain._mint37(collection.contract_address, to, newTokenId, req.body.quantity);
                }
                // update db
                if (mintResult.status !== 200) {
                    return handlerError(req, res, {error: mintResult.error});
                }
                await nftRepository.update(nft.id, {onchain: "true"})
            }

            return handlerSuccess(req, res, (req.body.batch === '' || req.body.batch === undefined) ? nft : ret);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    // Minting NFTs using MinIO via frontend Metamask
    createRentalNft: async (req, res, next) => {
        try {
            let errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            let admin_address = req.body.admin_address;

            let tokenIds = [];
            let ipfs_links = [];
            let newNfts = [];

            //check collection
            let collection = await collectionRepository.findById(req.body.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            let my_file = req.files.file[0];

            errors = validateCreateNft(req, res);
            if (errors) {
                return handlerError(req, res, errors[0]);
            }

            // MinIO
            const bucketName = 'nfts';
            const expires = parseInt(req.body.expires ?? 0, 10) * 3600 * 24; // 30 days
            const imageUrl = await createVault(
                my_file.filename,
                expires,
                bucketName
            );

            // IPFS
            let result = await nftRepository.addFileToIPFS(my_file);

            let imgName = my_file.originalname.split('.');
            let imgInput = my_file.filename;

            let renameOutput = result.Hash + '.' + imgName[imgName.length -1];
            // let imgOutput = result.Hash + '_resize.' + imgName[imgName.length -1];

            //rename
            const targetDir = `./uploads/${collection.contract_address}/`;
            await imageMove(consts.UPLOAD_PATH + imgInput,  targetDir + renameOutput);

            //resize
            // if (imgName[imgName.length -1].toLowerCase() === 'jpg'| imgName[imgName.length -1].toLowerCase() === 'png' | imgName[imgName.length -1].toLowerCase() === 'jpeg')
            // await imageResize('./uploads/' + renameOutput, './uploads/' + imgOutput);

            //thumbnail check
            let thumbName = null;
            if (typeof req.files.thumbnail != 'undefined') {
                let my_thumbnail = req.files.thumbnail[0];
                thumbName = my_thumbnail.filename.split('.');
                let thumbnailInput = my_thumbnail.filename;
                let thumbnailOutput = result.Hash + '_thumbnail.' + thumbName[thumbName.length -1];
                await imageMove(consts.UPLOAD_PATH + thumbnailInput, targetDir + 'thumbnail/' + thumbnailOutput);
            }

            let albumJacketUrl;
            if (req.files.album_jacket) {
                const albumJacket = req.files.album_jacket[0];
                const jacketName = albumJacket.filename.split('.');
                let albumJacketInput = albumJacket.filename;
                let albumJacketOutput = result.Hash + '_albumJacket.' + jacketName[jacketName.length -1];
                albumJacketUrl = ALT_URL + collection.contract_address + '/albumJacket/' + albumJacketOutput;
                await imageMove(consts.UPLOAD_PATH + albumJacketInput, targetDir + 'albumJacket/' + albumJacketOutput);
            }

            // tokenId를 순차적으로 증가 시키기 위해서 정보를 가지고 옴.
            //get all nft from blockchain service
            // let itemList = await nftRepository.getItemList();
            // //sort with value
            // itemList.items.sort(function (a, b) {
            //     return (
            //         parseInt(b.tokenId.replace('0x', ''), 16) -
            //         parseInt(a.tokenId.replace('0x', ''), 16)
            //     );
            // });
            // // get last tokenId in db
            // let lastTokenId = await listenerRepository.findLastTokenId();
            // let tokenIdBlockchain = itemList.items.length === 0 ? "1000" : itemList.items[0].tokenId;
            // let tokenId = parseInt(tokenIdBlockchain.replace('0x', ''), 16);
            // if (lastTokenId && lastTokenId.length !== 0) {
            //     if (tokenId < lastTokenId[0].token_id) {
            //         tokenId = parseInt(lastTokenId[0].token_id);
            //     }
            // }

            // get creator
            let creator = await adminRepository.findById(collection.creator_id, null);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            let lastNft = await nftRepository.findAllOnchainNftsByCollectionId(req.body.collection_id);
            let newTokenId = 0; // Start from 0
            if (lastNft.length > 0) {
                newTokenId = parseInt(lastNft[0].metadata.tokenId) + 1;
            }
            tokenIds.push('0x' + newTokenId.toString(16));

            let category;
            if (req.body.category)
                category = req.body.category.split(',');

            const attributes = req.body.attributes ? JSON.parse(req.body.attributes) : [];

            //nft default
            let newNft = {
                metadata: {
                    name: req.body.name,
                    description: req.body.description,
                    // image: IPFS_URL + result.Hash,
                    image: imageUrl,
                    // alt_url: ALT_URL + result.Hash + '.' + imgName[imgName.length -1],
                    alt_url: ALT_URL + collection.contract_address + '/' + result.Hash + '.' + imgName[imgName.length -1],
                    content_Type: imgName[imgName.length -1],
                    cid: result.Hash,
                    tokenId: newTokenId.toString(),
                    total_minted: "",
                    external_url: req.body.external_url,
                    attributes: attributes,
                    minted_by: creator.full_name,
                    // thumbnail: ALT_URL + my_thumbnail.path,
                    thumbnail: "",
                    creator_name: creator.full_name,
                    creator_icon: creator.image,
                    category: [],
                    // category: req.body.category.toString(),
                },
                // company_id: req.body.company_id,
                collection_id: req.body.collection_id,
                creator_id: creator._id,
                type: req.body.type * 1,
                contract_type: req.body.contract_type,
                onchain: "false",
                ...(req.body?.price && {price: req.body.price}),
                ...(req.body?.quote && {quote: req.body.quote}),
                ...(req.body?.quote && {last_quote: req.body.quote}),
                ...(req.body?.quote && {floor_quote: req.body.quote}),
                ...(req.body?.quantity && {quantity: req.body.quantity}),
                ...(req.body?.quantity && {quantity_selling: 0}),
                ...(req.body?.start_date && {start_date: req.body.start_date}),
                ...(req.body?.end_date && {end_date: req.body.end_date}),
                ...(req.body?.status && {status: req.body.status}),
                // ...(req.body?.category && {category: req.body.category}),
                ...(req.body?.category && {category}),
                ...(req.body?.description && {description: req.body.description}),
                // ...(req.body?.rarity && {rarity: req.body.rarity}),
                // contract_id: contractId,
                album_jacket: albumJacketUrl,
                transfered: 0,
                filename: my_file.filename
            };

            const coinPrice = await getCoinPrice();
            if (newNft.quote !== 'krw')
                newNft.sort_price = (new BigNumber(newNft.price)).multipliedBy(coinPrice[newNft.quote].USD).toNumber();
            else {
                const usd = await getExchange();
                newNft.sort_price = (new BigNumber(newNft.price)).dividedBy(new BigNumber(usd.data[0].basePrice)).toNumber();
            }

            let metadata_ipfs = newNft.metadata;

            if (req.body.category) {
                // metadata_ipfs.category = req.body.category;
                // newNft.metadata.category = req.body.category;
                metadata_ipfs.category = category;
                newNft.metadata.category = category;
            }
            if (req.body.quantity) {
                metadata_ipfs.total_minted = req.body.quantity;
            }

            //thumbnail check
            if (typeof req.files.thumbnail != 'undefined') {
                metadata_ipfs.thumbnail = ALT_URL + `${collection.contract_address}/thumbnail/` + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
            }

            // >>>>>>>>
            const cnt = parseInt((req.body.batch !== undefined && req.body.batch !== '') ? req.body.batch : '1');
            for (let i = 0; i < cnt; i++) {
                let tId = newTokenId + i;
                metadata_ipfs.tokenId = tId;
                if (collection.contract_type === 'KIP17') {
                    metadata_ipfs.name = req.body.name + ' #' + tId;
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
                if (collection.contract_type === 'KIP17') {
                    newNft.metadata_link = ALT_URL + '/nfts/metadata/' + metadata_ipfs_link.Hash + '.json';
                } else {
                    // ERC-1155
                    try {
                        if (fs.existsSync(`./uploads/nfts/metadata/${collection.directory}`) === false) {
                            console.log("Create metadata directory...");
                            await fs.mkdir(`./uploads/nfts/metadata/${collection.directory}`, {recursive: true}, (err) => {
                                if (err) throw err;
                            });
                        }
                    } catch (e) {
                        console.log("Error accessing metadata directory...")
                    }

                    newNft.metadata_link = ALT_URL + `/nfts/metadata/${collection.directory}` + '/0x' + tId.toString(16) + '.json';
                }

                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }

                let metadataForIpfs = {...metadata_ipfs};
                delete metadataForIpfs.tokenId;

                // write json file
                if (collection.contract_type === 'KIP17') {
                    await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadataForIpfs), 1);
                } else {
                    await writeJson(consts.UPLOAD_PATH + `metadata/${collection.directory}` + '/0x' + tId.toString(16) + ".json", JSON.stringify(metadataForIpfs), 1);
                }

                // TODO : What and why ?
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

                if (newNft.type === 1) {
                    newNft.price = 0;
                }

                let tempNft = {...newNft};
                newNfts.push(tempNft);
            }

            //serial default
            const newSerial = {
                type: req.body.type,
                ...(req.body?.status && {status: req.body.status}),
                contract_address: collection.contract_address.toLowerCase()
            };

            // let nft = await nftRepository.create(newNft, newSerial, tokenIds, ipfs_links);
            let nft;
            let ret = {nftIds: [], tokenIds: [], quantities: [], tokenUris: []};

            let tokenId;
            for (let i = 0; i < cnt; i++) {
                tokenId = '0x' + (newTokenId + i).toString(16);
                newNfts[i].metadata.tokenId = (newTokenId + i).toString();
                if (collection.contract_type === 'KIP17') {
                    newNfts[i].metadata.name = req.body.name + ' #' + (newTokenId + i).toString();
                } else {
                    newNfts[i].metadata.name = req.body.name;
                }
                console.log('--->', newNfts[i], newSerial, tokenId, ipfs_links[i], collection.creator_id.admin_address);
                nft = await nftRepository.createByWallet(newNfts[i], newSerial, tokenId, ipfs_links[i], collection.creator_id.admin_address, collection.contract_type);
                ret.nftIds.push(nft._id);
                ret.tokenIds.push(newTokenId + i);
                ret.quantities.push(nft.quantity);
                ret.tokenUris.push(nft.ipfs_link);
            }

            if (!nft) {
                return handlerError(req, res, ErrorMessage.CREATE_NFT_IS_NOT_SUCCESS);
            }

            if (req.body.auto === 'true') {
                let to = creator.admin_address;
                let tokenUri = newNft.ipfs_link;
                // mint nft
                let mintResult
                if (collection.contract_type === 'KIP17') {
                    mintResult = await nftBlockchain._mint17(collection.contract_address, to, newTokenId, tokenUri);
                } else if (collection.contract_type === 'KIP37') {
                    mintResult = await nftBlockchain._mint37(collection.contract_address, to, newTokenId, req.body.quantity);
                }
                // update db
                if (mintResult.status !== 200) {
                    return handlerError(req, res, {error: mintResult.error});
                }
                await nftRepository.update(nft.id, {onchain: "true"})
            }

            return handlerSuccess(req, res, (req.body.batch === '' || req.body.batch === undefined) ? nft : ret);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    // Minting NFTs on Solana Network
    createSolanaNft: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            // let admin_address = req.body.admin_address;

            let collection = await collectionRepository.findById(req.body.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            // //upload file
            // // await uploadRepository(req, res);
            // let my_file = req.files.file[0];

            errors = validateCreateNft(req, res);
            if (errors) {
                return handlerError(req, res, errors[0]);
            }

            // let result = await nftRepository.addFileToIPFS(my_file);
            // let imgName = my_file.filename.split('.');
            // let imgInput = my_file.filename;
            //
            // let renameOutput = result.Hash + '.' + imgName[imgName.length -1];
            // let imgOutput = result.Hash + '_resize.' + imgName[imgName.length -1];
            //
            // //rename
            // // await imageRename(consts.UPLOAD_PATH + imgInput, consts.UPLOAD_PATH + renameOutput);
            // const targetDir = `./uploads/${collection.contract_address}/`;
            // await imageMove(consts.UPLOAD_PATH + imgInput,  targetDir + renameOutput);
            //
            // // //resize
            // // if (imgName[imgName.length -1].toLowerCase() === 'jpg'| imgName[imgName.length -1].toLowerCase() === 'png' | imgName[imgName.length -1].toLowerCase() === 'jpeg')
            // // await imageResize('./uploads/' + renameOutput, './uploads/' + imgOutput);
            //
            // //thumbnail check
            // let thumbName = null;
            // if (typeof req.files.thumbnail != 'undefined') {
            //     let my_thumbnail = req.files.thumbnail[0];
            //     thumbName = my_thumbnail.filename.split('.');
            //     let thumbnailInput = my_thumbnail.filename;
            //     let thumbnailOutput = result.Hash + '_thumbnail.' + thumbName[thumbName.length -1];
            //     // await imageRename(consts.UPLOAD_PATH + thumbnailInput, consts.UPLOAD_PATH + 'thumbnail/' + thumbnailOutput);
            //     await imageMove(consts.UPLOAD_PATH + thumbnailInput, targetDir + 'thumbnail/' + thumbnailOutput);
            // }

            // TODO : nftRepository.getItemList() - made by James - 를 알 수가 없음.
            // //get all nft from blockchain service
            // let itemList = await nftRepository.getItemList();
            // //sort with value
            // itemList.items.sort(function (a, b) {
            //     return (
            //         parseInt(b.tokenId.replace('0x', ''), 16) -
            //         parseInt(a.tokenId.replace('0x', ''), 16)
            //     );
            // });
            // get last tokenId in db
            // let lastTokenId = await listenerRepository.findLastTokenId();
            // let lastTokenId = await listenerRepository.findLastTokenOfAddress(collection.contract_address);
            // let tokenIdBlockchain = itemList.items.length === 0 ? "1000" : itemList.items[0].tokenId;
            // let tokenId = parseInt(tokenIdBlockchain.replace('0x', ''), 16);
            // if (lastTokenId && lastTokenId.length !== 0) {
            //     if (tokenId < lastTokenId[0].token_id) {
            //         tokenId = parseInt(lastTokenId[0].token_id);
            //     }
            // }

            let lastNft = await nftRepository.findAllOnchainNftsByCollectionId(req.body.collection_id);
            let tokenId = 0;
            if (lastNft.length > 0) {
                tokenId = parseInt(lastNft[0].metadata.tokenId) + parseInt(lastNft[0].quantity, 10) - 1;
            }
            console.log('== Last Token ID =====>', tokenId)

            //check company
            // let company = await companyRepository.findById(req.body.company_id);
            // if (!company) {
            //     return handlerError(req, res, ErrorMessage.COMPANY_IS_NOT_FOUND);
            // }
            let creator = await adminRepository.findById(collection.creator_id);
            if (!creator) {
                return handlerError(req, res, ErrorMessage.CREATOR_IS_NOT_FOUND);
            }

            //check contract
            // TODO: 2021.12.28 추후 수정할 수 도 있음. 지금은 DB에 직접 contract를 추가하도록 한다.
            // let contract = await contractRepository.findByContractAddress(process.env.NFT_CONTRACT_ADDR);
            // let contractId = new ObjectID(contract._id);

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
            let category;
            if (req.body.category)
                category = req.body.category.split(',');

            const attributes = req.body.attributes ? JSON.parse(req.body.attributes) : [];

            for (let i = 0; i < quantity; i++) {
                // 수량에 맞춰 newNft를 만들고 newNfts배열에 저장
                let newNft = {
                    metadata: {
                        name: req.body.name,
                        description: req.body.description,
                        // image: IPFS_URL + result.Hash,
                        // alt_url: ALT_URL + result.Hash + '.' + imgName[imgName.length -1],
                        // content_Type: imgName[imgName.length -1],
                        // cid: result.Hash,
                        image: collection.cover_image,
                        alt_url: ALT_URL + collection.path.replace('/taalNft', ''),
                        content_Type: collection.path.split(',')[1],
                        cid: '',
                        tokenId: decimalTokenIds[i],
                        total_minted: "",
                        external_url: req.body.external_url,
                        attributes: attributes,
                        minted_by: creator.full_name,
                        thumbnail: ALT_URL + collection.path.replace('/taalNft', ''),
                        creator_name: creator.full_name,
                        creator_icon: creator.image,
                        category: [],
                    },
                    onchain: false,
                    // company_id: req.body.company_id,
                    collection_id: req.body.collection_id,
                    creator_id: creator._id,
                    type: req.body.type * 1,
                    ...(req.body?.price && {price: req.body.price}),
                    ...(req.body?.quote && {quote: req.body.quote}),
                    ...(req.body?.quantity && {quantity: req.body.quantity}),
                    ...(req.body?.quantity && {quantity_selling: 0}),
                    ...(req.body?.start_date && {start_date: req.body.start_date}),
                    ...(req.body?.end_date && {end_date: req.body.end_date}),
                    ...(req.body?.status && {status: req.body.status}),
                    // ...(req.body?.category && {category: JSON.parse(req.body.category)}),
                    // ...(req.body?.category && {category: req.body.category}),
                    ...(req.body?.category && {category}),
                    ...(req.body?.description && {description: req.body.description}),
                    ...(req.body?.rarity && {rarity: req.body.rarity}),
                    // contract_id: contractId,
                    transfered: 0
                };

                let metadata_ipfs = newNft.metadata;
                if (req.body.category) {
                    // metadata_ipfs.category = JSON.parse(req.body.category);
                    // newNft.metadata.category = JSON.parse(req.body.category);
                    // metadata_ipfs.category = req.body.category;
                    // newNft.metadata.category = req.body.category;
                    metadata_ipfs.category = category;
                    newNft.metadata.category = category;
                }
                if (req.body.quantity) {
                    // metadata_ipfs.total_minted = JSON.parse(req.body.quantity);
                    metadata_ipfs.total_minted = req.body.quantity;
                }

                // //thumbnail check
                // if (typeof req.files.thumbnail != 'undefined') {
                //     metadata_ipfs.thumbnail = ALT_URL + `${collection.contract_address}/thumbnail/` + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
                // }

                // let metadata_ipfs_link = await nftRepository.addJsonToIPFS(metadata_ipfs);
                // // remove ipfs links array from metadata
                // // let ipfs_link_item = {
                // //     tokenId: decimalTokenIds[i],
                // //     path: IPFS_URL + metadata_ipfs_link.Hash
                // // }
                // // ipfs_links.push(ipfs_link_item);
                // // newNft.ipfs_links = ipfs_links;
                // ipfs_links.push(IPFS_URL + metadata_ipfs_link.Hash)
                // newNft.ipfs_link = IPFS_URL + metadata_ipfs_link.Hash;

                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }

                // // write json file
                // await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadata_ipfs), i+1);

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
                    contract_address: collection.contract_address
                };

                if (newNft.type === 1) {
                    newNft.price = 0;
                }
                newNfts.push(newNft);
                newSerials.push(newSerial);
            }

            let nft = await nftRepository.create(newNfts[0], newSerials[0], tokenIds, ipfs_links);

            if (!nft) {
                return handlerError(req, res, ErrorMessage.CREATE_NFT_IS_NOT_SUCCESS);
            }
            // for (let i = 0; i < tokenIds.length; i++) {
            //     let to = admin_address;
            //     let newTokenId = tokenIds[i];
            //     let tokenUri = ipfs_links[i];
            //     // mint nft
            //     // let mintResult = await nftBlockchain._mint(to, newTokenId, tokenUri);
            //     let mintResult = await nftBlockchain._mint17(collection.contract_address, to, newTokenId, tokenUri);
            //     if (mintResult.status !== 200) {
            //         // return handlerError(req, res, {error: mintResult.error});
            //         console.log('====>', )
            //         continue;
            //     }
            // }

            // await nftRepository.update(nft._id, {onchain: 'true'});

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

    async indexNftsM(req, res, next) {
        try {
            var findParams = getFindParams(req.query);
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            const count = await nftRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            const flCreatedAt = parseInt(req.query.createdAt);
            const flPrice = parseInt(req.query.price);
            const flTokenId = parseInt(req.query.tokenId);

            const nfts = await nftRepository.findAllExt(findParams, {page, perPage}, flCreatedAt, flPrice, flTokenId);
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

    async indexNftsR(req, res, next) {
        try {
            var findParams = getFindParams(req.query);

            console.log('3--->', findParams)

            const nfts = await nftRepository.findRandom(findParams);
            if (!nfts) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const productRes = convertProductResponse(nfts);
            return handlerSuccess(req, res, {
                items: productRes
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
            if (nft.selling_status === SELLING_STATUS.SELL) {
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

    async updateNftOnchains(req, res, next) {
        try {
            console.log('111', req.body.nftIds);
            const updateNfts = await nftRepository.updateSchedule(req.body.nftIds, {
                onchain: req.body.onchain,
            });
            console.log('222', updateNfts);
            if (!updateNfts) {
                return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
            }

            return handlerSuccess(req, res, updateNfts);
        } catch (error) {
            console.log('333', error);
            logger.error(new Error(error));
            next(error);
        }
    },

    async updateNftOnchain(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const nft = await nftRepository.findById(req.params.id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const collection = await collectionRepository.findById(nft.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            // TODO : Why ?
            // if (req.body.status === NFT_STATUS.SUSPEND) {
            //     return handlerError(req, res, ErrorMessage.STATUS_UPDATE_INVALID);
            // }
            //
            // let selling_status = SELLING_STATUS.SELL;
            // if (nft.selling_status === SELLING_STATUS.SELL) {
            //     selling_status = SELLING_STATUS.STOP;
            // }

            const updateNft = await nftRepository.update(req.params.id, {
                onchain: req.body.onchain,
            });
            if (!updateNft) {
                return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
            }

            if (collection.network === 'solana' && req.body.onchain === 'active') {
                const updateNft = await nftRepository.update(req.params.id, {
                    status: 'active',
                });
                if (!updateNft) {
                    return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
                }
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
            if (nft.status === NFT_STATUS.ACTIVE) {
                status = NFT_STATUS.INACTIVE;
            }

            let serials = await serialRepository.findByNftId(req.params.id);

            let serialStatus = [SERIAL_STATUS.ACTIVE, SERIAL_STATUS.INACTIVE];
            let serialIds = [];
            for (let i = 0; i < serials.length; i++) {
                if (serials[i].owner_id === null && serialStatus.includes(serials[i].status)) {
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
            const data = getUpdateScheduleBodys(req.body);

            if (isEmptyObject(data)) {
                return handlerError(req, res, ErrorMessage.FIELD_UPDATE_IS_NOT_BLANK);
            }

            const nft = await nftRepository.findById(req.body.id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }
            if (nft.status === 'inactive' || nft.onchain === 'false') {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_ACTIVE);
            }
            const network = nft.collection_id.network;
            const marketAddress = getMarketAddress(network);

            const useKas = req.body.use_kas;
            let current_time = new Date();
            let input = {};
            // selling status = 0 vs time > now > time
            if (nft.selling_status === consts.SELLING_STATUS.SELL && nft.quantity_selling !== 0) {
                if (checkTimeCurrent(nft.start_date, current_time, nft.end_date))
                    return handlerError(
                        req,
                        res,
                        `Nft id "${nft._id}" is not allow to update!`,
                    );
            }
            let startDate = new Date(convertTimezone(data.start_date).setSeconds(0, 0));
            input.start_date = startDate;

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

            if (useKas === 'true') {
                const sellResult = await sellNFTs(nft);
                console.log(sellResult, nft._id);
                if (sellResult.status === 200 && sellResult.result.fail.length === 0) {
                    const updateNft = await nftRepository.updateSchedule([nft._id], input);
                    if (updateNft)
                        return handlerSuccess(req, res, 'Update Nfts successed!');
                    else
                        return handlerError(req, res, {fail: nft});
                } else
                    return handlerError(req, res, {fail: nft});
            } else {
                const serial = await serialRepository.findOneSerial({nft_id: nft._id, owner_id: req.body.seller});
                if (!serial) {
                    return handlerError(req, res, ErrorMessage.NOT_NFT_OWNER);
                }
                const updateNft = await nftRepository.updateSchedule([nft._id], data);
                if (!updateNft) {
                    return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
                }
                const result = await serialRepository.update(
                    {nft_id: nft._id, owner_id: {$in: [req.body.seller, null]}}
                    , {owner_id: nft.quote === 'krw' ? req.body.seller : marketAddress, seller: req.body.seller, status: consts.SERIAL_STATUS.SELLING}
                );
                if (result.nModified === 0) {
                    return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
                }
                await nftRepository.updateSellingData(nft._id, result.nModified);
                if (nft.quote === 'krw') {
                    // history 생성
                    const history = {
                        token_id: nft.metadata.tokenId,
                        tx_id: '',
                        contract_address: nft.collection_id.contract_address,
                        nft_id: nft._id,
                        from: req.body.seller,
                        chain_id: getChainId(network),
                        quantity: nft.quantity,
                        price: nft.price,
                        quote: nft.quote,
                        block_number: 0,
                        block_date: new Date(),
                        type: consts.LISTENER_TYPE.SELL,
                    };
                    await listenerRepository.create(history);
                }
            }

            return handlerSuccess(req, res, 'Update Nfts successed!');
        } catch (error) {
            console.log(error);
            logger.error(new Error(error));
            next(error);
        }
    },

    async stopSelling(req, res, next) {
        try {
            const data = {quantity_selling: 0, sell_amount: 0, start_date: null, end_date: null, updatedAt: Date.now()};
            const account = req.body.owner;
            const nft = await nftRepository.findById(req.body.id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }
            const useKas = req.body.use_kas;

            const marketAddress = getMarketAddress(nft.collection_id.network);

            if (useKas === 'true') {
                // TODO : market contract 에 cancelSellToken 호출

            } else {
                const serial = await serialRepository.findOneSerial({nft_id: nft._id, owner_id: account});
                console.log(serial, account);
                if (!serial) {
                    return handlerError(req, res, ErrorMessage.NOT_NFT_OWNER);
                }
                const updateNft = await nftRepository.updateOneSchedule(nft._id, data);
                if (nft.quote === 'krw') {
                    await serialRepository.update({nft_id: nft._id, owner_id: account}, {owner_id: account, seller: null, status: consts.SERIAL_STATUS.ACTIVE});
                    const history = {
                        token_id: nft.metadata.tokenId,
                        tx_id: '',
                        contract_address: nft.collection_id.contract_address,
                        nft_id: nft._id,
                        from: req.body.seller,
                        chain_id: getChainId(nft.collection_id.network),
                        quantity: nft.quantity,
                        price: nft.price,
                        quote: nft.quote,
                        block_number: 0,
                        block_date: new Date(),
                        type: consts.LISTENER_TYPE.CANCEL,
                    };
                    await listenerRepository.create(history);
                } else {
                    await serialRepository.update({nft_id: nft._id, owner_id: marketAddress}, {owner_id: account, seller: null, status: consts.SERIAL_STATUS.ACTIVE});
                }

                if (!updateNft) {
                    return handlerError(req, res, ErrorMessage.UPDATE_NFT_IS_NOT_SUCCESS);
                }
            }

            return handlerSuccess(req, res, 'Stop selling successed!');
        } catch (error) {
            logger.error(new Error(error));
            return handlerError(req, res, error.message);
        }
    },

    async cancelCreateNfts(req, res, next) {
        try {
            console.log('111', req.body.nftIds);
            await nftRepository.cancelCreateNfts(req.body.nftIds);
            await serialRepository.cancelCreateNfts(req.body.nftIds);
            return handlerSuccess(req, res, 'cancel create nfts.');
        } catch (error) {
            console.log('222', error);
            logger.error(new Error(error));
            return handlerError(req, res, error.message);
        }
    },

    async cancelCreateNft(req, res, next) {
        if (ObjectID.isValid(req.params.id) === false) {
            return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
        }

        const nft = await nftRepository.findById(req.params.id);

        if (!nft) {
            return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
        }

        await nftRepository.cancelCreateNft(req.params.id);
        await serialRepository.cancelCreateNft(req.params.id);
        return handlerSuccess(req, res, 'cancel create nft.');
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
                if (serials[i].owner_id === null && status.includes(serials[i].status)) {
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

    async increaseTransfered(req, res, next) {
        try {
            if (ObjectID.isValid(req.params.id) === false) {
                return handlerError(req, res, ErrorMessage.ID_IS_INVALID);
            }

            const nft = await nftRepository.findById(req.params.id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const newValue = parseInt(nft.transfered, 10) + parseInt(req.body.transfered, 10);
            const updateNft = await nftRepository.update(req.params.id, {
                transfered: newValue,
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

    setNftTransferData: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }

            let nft = await nftRepository.findById(req.body.nft_id);
            if (!nft) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            let collection = await collectionRepository.findById(nft.collection_id);
            if (!collection) {
                return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
            }

            let serials = await serialRepository.findByNftIdNotTRransfered(nft._id);
            if (!serials || serials.length === 0) {
                return handlerError(req, res, ErrorMessage.NO_NFT_IS_AVAILABLE);
            }

            // 어떤 걸 쓰는 게 맞을까?
            const serial = serials[0];
            // const serial = await serialRepository.findOneSerial({
            //     // _id: req.body.serial_id,
            //     _id: serials[0]._id,
            //     status: consts.SERIAL_STATUS.ACTIVE,
            //     // owner_id: user._id,
            //     owner_id: null,
            //     // nft_id: req.body.nft_id,
            //     nft_id: nft._id,
            //     transfered: consts.TRANSFERED.NOT_TRANSFER,
            // });

            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            const tx = await txRepository.createTx({
                // TODO : (중요) KIP37인 경우는 어떻하지?
                // KIP37의 경우 보낸 amount 중 첫번째 serial id만 기록됨.
                serial_id: serial._id,
                seller: collection.creator_id,
                // buyer: user.id,
                price: nft.price,
                quote: nft.quote,
                buyer: req.body.to_address,
                status: consts.TRANSACTION_STATUS.PROCESSING,
            });

            let amount = req.body.amount;

            // Update owner of serial
            if (req.body.transactionHash) {
                tx.tx_id = req.body.transactionHash;
                tx.date = Date.now();
                tx.updatedAt = Date.now();
                await tx.save();

                // create new history
                let hs = JSON.parse(JSON.stringify(tx));
                hs.memo = consts.HISTORY_MEMO.WALLET_TRANSFER;
                hs.status = consts.TRANSACTION_STATUS.SUCCESS;
                await historyRepository.createTx(hs);

                // update db
                const transfered = parseInt(nft.transfered, 10) + parseInt(amount, 10);
                const quantitySelling = parseInt(nft.quantity_selling, 10) - parseInt(amount, 10);
                await nftRepository.update(nft._id, {transfered, quantity_selling: quantitySelling});
                // await serialRepository.updateById(serial._id, {owner_id: tx.buyer});
                let ids = [];
                for (let i = 0; i < amount; i++) {
                    ids.push(serials[i]._id)
                }
                await serialRepository.updateByIds(ids, {owner_id: tx.buyer, status: consts.SERIAL_STATUS.ACTIVE});
                if (nft.quote === 'krw') {
                    // history 생성
                    const history = {
                        token_id: nft.metadata.tokenId,
                        tx_id: tx.tx_id,
                        contract_address: collection.contract_address,
                        nft_id: nft._id,
                        from: serial.owner_id,
                        to: tx.buyer,
                        chain_id: getChainId(collection.network),
                        quantity: amount,
                        price: nft.price,
                        quote: nft.quote,
                        block_number: 0,
                        block_date: new Date(),
                        type: consts.LISTENER_TYPE.BUY,
                    };
                    await listenerRepository.create(history);
                }
                // 크롤러가 처리하는 듯...
                // await serialRepository.updateById(serial._id, {transfered: TRANSFERED.TRANSFERED});

                return handlerSuccess(req, res, {result: 1});
            }
            // Update status of transaction to ERROR
            else {
                tx.status = consts.TRANSACTION_STATUS.ERROR;
                tx.date = Date.now();
                tx.updatedAt = Date.now();
                await tx.save();

                // create new history
                let hs = JSON.parse(JSON.stringify(tx));
                hs.memo = consts.HISTORY_MEMO.TRANSFER_ERROR;
                await historyRepository.createTx(hs);

                return handlerError(req, res, {result: 0});
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
    userSerials: async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }
        const ownerId = req.query.owner_id;
        const nftId = req.query.nft_id;
        const serials = await serialRepository.findByOwnerIdAndNftId(ownerId, nftId);
        // console.log(serials);
        if (serials.length > 0)
            return handlerSuccess(req, res, serials);
        else
            return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
    },
    userNFTs: async (req, res, next) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            let errorMsg = _errorFormatter(errors.array());
            return handlerError(req, res, errorMsg);
        }
        const address = req.query.address;
        const size = req.query.size;
        const page = req.query.page;
        const cursor = req.query.cursor;

        let nfts = [];
        const serials = await serialRepository.findByOwnerId(address, size, page ? page : 0);
        for (let i = 0; i < serials.length; i++) {
            const nft = serials[i].nft_id;
            const exist = nfts.some((item) => {
                return item._id.toString() === nft._id.toString();
            });
            if (!exist)
                nfts.push(nft);
        }
        console.log('=====>', serials.length, nfts.length);

        // const transferResult = await nftBlockchain._userNFTs(address, size, cursor ? cursor : '');
        // if (transferResult.status == 200) {
        //     let nfts = [];
        //     try {
        //         for (let i = 0; i < transferResult.data.items.length; i++) {
        //             // find serial
        //             const serial = await serialRepository.findOneSerialDetail({
        //                 contract_address: transferResult.data.items[i].contractAddress,
        //                 token_id: transferResult.data.items[i].extras.tokenId,
        //             });
        //             // find nft
        //             if (serial) {
        //                 const nft = serial.nft_id;
        //                 // console.log(nft);
        //                 const exist = nfts.some((item) => {
        //                     return item._id.toString() === nft._id.toString();
        //                 });
        //                 if (!exist)
        //                     nfts.push(nft);
        //             }
        //         }
        //     } catch (e) {
        //         console.log(e);
        //     }
        //     console.log(nfts);
            return handlerSuccess(req, res, {nfts});
        // } else {
        //     return handlerError(req, res, {error: transferResult.response.data});
        // }
    },
    sellNFTs: async (req, res, next) => {
        // contract_address, nft_id 를 사용해서 serials 모두 sell 처리
        // nftId check
        const nftId = req.query.nft_id;
        const result = await sellNFTs(nftId);
        if (result.status !== 200)
           return handlerError(req, res, result.error);
        return handlerSuccess(req, res, result);
    },
    selectSerials: async (req, res, next) => {
        const nftId = req.query.nft_id;
        const buyer = req.query.buyer;
        const amount = parseInt(req.query.amount);
        if (amount <= 0) {
            return handlerError(req, res, ErrorMessage.BUY_AMOUNT_IS_ZERO);
        }
        const serials = await serialRepository.findByNftIdAndUpdate(nftId, buyer, amount);
        console.log('=====', serials);
        if (serials.length > 0) {
            const nft = await nftRepository.updateQuantitySelling(new ObjectID(nftId), -serials.length);
            return handlerSuccess(req, res, serials);
        }
        else
            return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
    },
    cancelBuy: async (req, res, next) => {
        const nftId = req.query.nft_id;
        const tokenId = req.query.token_id;
        const buyer = req.query.buyer;
        const result = await serialRepository.update({nft_id: nftId, token_id: tokenId, buyer}, {buyer: null, status: SERIAL_STATUS.SELLING});
        const nft = await nftRepository.updateQuantitySelling(nftId, result.nModified);
        return handlerSuccess(req, res, result);
    }
};

async function sellNFTs(nftId) {
    const nft = await nftRepository.findById(nftId);
    if (!nft) {
        return {status: 500, error: ErrorMessage.NFT_IS_NOT_FOUND};
    }

    // collectionId check
    const collection = await collectionRepository.findById(nft.collection_id);
    if (!collection) {
        return {status: 500, error: ErrorMessage.COLLECTION_IS_NOT_FOUND};
    }

    const marketAddress = getMarketAddress(collection.network);

    const serials = await serialRepository.findByNftIdNotTRransfered(nftId);
    if (!serials) {
        return {status: 500, error: ErrorMessage.SERIAL_IS_NOT_FOUND};
    }

    // loop 를 여기서 돌리자.
    await nftBlockchain._approveSellNFTs(collection, serials);
    const readyToSellTokens = [];
    const failToSellTokens = [];
    for (let i=0; i < serials.length; i++) {
        const tx = await txRepository.createTx({
            serial_id: serials[i]._id,
            seller: collection.creator_id,
            buyer: marketAddress,
            price: nft.price,
            quote: nft.quote,
            status: consts.TRANSACTION_STATUS.PROCESSING,
        });
        let quoteToken;
        switch(nft.quote) {
            case 'klay':
                quoteToken = quoteTokens[nft.quote][process.env.KLAYTN_CHAIN_ID];
                break;
            case 'bnb':
                quoteToken = quoteTokens[nft.quote][process.env.BINANCE_CHAIN_ID];
                break;
            case 'eth':
                quoteToken = quoteTokens[nft.quote][process.env.ETH_CHAIN_ID];
            default:
                break;
        }
        console.log(collection.contract_address, serials[i].token_id, nft.price.toString(), quoteToken);
        const transferResult = await nftBlockchain._sellNFT(network, collection.contract_address, serials[i].token_id, nft.price.toString(), quoteToken, marketAddress);
        if (transferResult.status === 200) {
            tx.tx_id = transferResult.result;
            tx.date = Date.now();
            tx.updatedAt = Date.now();
            tx.status = consts.TRANSACTION_STATUS.SUCCESS
            await tx.save();
            readyToSellTokens.push(serials[i].token_id);
        } else {
            tx.status = consts.TRANSACTION_STATUS.ERROR;
            tx.date = Date.now();
            tx.updatedAt = Date.now();
            await tx.save();
            failToSellTokens.push(serials[i].token_id);
        }
        await serialRepository.updateById(serials[i]._id, {price: nft.price, quote: nft.quote, owner_id: marketAddress, status: consts.SERIAL_STATUS.SELLING});
    }
    return {status: 200, result: {success: readyToSellTokens, fail: failToSellTokens}};
}

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

    if (filters.onchain) {
        findParams.onchain = filters.onchain;
    }

    if (filters.creator_id) {
        findParams.creator_id = filters.creator_id;
    }

    if (filters.collection_id) {
        findParams.collection_id = filters.collection_id;
    }
    if (filters.collection_id && filters.onSale === 'true') {
        findParams.$or = [ { quantity_selling: {$gt: 0} }, { user_quantity_selling: {$gt: 0} } ]
        findParams.start_date = {$lte: new Date()}
        findParams.end_date = {$gte: new Date()}
    }

    const nft_id = filters.nft_id;
    if (filters.nft_id) {
        findParams._id = {$ne: nft_id};
    }

    if (filters.low || filters.high) {
        if (filters.high > 0) {
            findParams.price = { $lte: filters.high,  $gte: filters.low };
        } else {
            findParams.price = { $gte: filters.low };
        }
    }

    const findByName = Object.assign({}, findParams);
    const findByDesc = Object.assign({}, findParams);
    const findByMetadataName = Object.assign({}, findParams);
    // const findByCompanyId = Object.assign({}, findParams);
    const findByCreatorId = Object.assign({}, findParams);
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
            // findByCompanyId.company_id = addMongooseParam(
            //     findByCompanyId.company_id,
            //     '$eq',
            //     filters.keyword,
            // );

            findByCreatorId.creator_id = addMongooseParam(
                findByCreatorId.creator_id,
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

    let searchParams;

    if (filters.keyword) {
        searchParams = {
            $or: [findByName, findByDesc, findByMetadataName],
        };

        if (ObjectID.isValid(filters.keyword) === true) {
            // searchParams['$or'].push(findByCompanyId, findByCollectionId);
            searchParams['$or'].push(findByCreatorId, findByCollectionId);
        }
    } else {
        searchParams = findParams;
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
        if (element.quantity_selling > 0 || element.user_quantity_selling > 0) {
            if (element.selling_status === consts.SELLING_STATUS.SELL) {
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
            if (element.selling_status === consts.SELLING_STATUS.STOP) {
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

    // TODO : KIP37인 경우에만 검사하도록
    // if (!req.body.quantity || req.body.quantity.length === 0) {
    //     err.push('Missing quantity parameter');
    //     return err;
    // }

    // TODO : 필수인가?
    if (!req.body.description || req.body.description.length === 0) {
        err.push('Missing description parameter');
        return err;
    }

    // if (!req.body.company_id || req.body.company_id.length === 0) {
    //     err.push('Missing company_id parameter');
    //     return err;
    // }

    if (!req.body.collection_id || req.body.collection_id .length === 0) {
        err.push('Missing collection_id parameter');
        return err;
    }

    // if (!req.body.rarity || req.body.rarity.length === 0) {
    //     err.push('Missing rarity parameter');
    //     return err;
    // }

    if (req.body.type * 1 === NFT_TYPE.NORMAL) {
        // Collection의 Category를 따라감...
        // if (!req.body.category || req.body.category.length === 0) {
        //     err.push('Missing category parameter');
        //     return err;
        // }

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
