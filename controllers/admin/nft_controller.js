const _ = require('lodash');
const sleep = require('sleep');
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
const collectionRepository = require('../../repositories/collection_repository');
const creatorRepository = require('../../repositories/creator_repository');
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
    writeJson, imageMove,
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
const marketAddress = process.env.MARKET_CONTRACT_ADDRESS;

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
            let lastTokenId = await listenerRepository.findLastTokenOfAddress(collection.contract_address);
            // let tokenIdBlockchain = itemList.items.length === 0 ? "1000" : itemList.items[0].tokenId;
            // let tokenId = parseInt(tokenIdBlockchain.replace('0x', ''), 16);
            // if (lastTokenId && lastTokenId.length !== 0) {
            //     if (tokenId < lastTokenId[0].token_id) {
            //         tokenId = parseInt(lastTokenId[0].token_id);
            //     }
            // }
            let tokenId = 0;
            if (lastTokenId.length > 0) {
                tokenId = parseInt(lastTokenId[0].token_id);
            }
            console.log('=======>', lastTokenId, tokenId)

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
                        image: IPFS_URL + result.Hash,
                        alt_url: ALT_URL + collection.contract_address + '/' + result.Hash + '.' + imgName[imgName.length -1],
                        content_Type: imgName[imgName.length -1],
                        cid: result.Hash,
                        tokenId: decimalTokenIds[i],
                        total_minted: "",
                        external_url: req.body.external_url,
                        attributes: attributes,
                        minted_by: "Talken",
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

                console.log('==========>', newNft)
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
            let lastTokenId = await listenerRepository.findLastTokenOfAddress(collection.contract_address);
            // let tokenIdBlockchain = itemList.items.length === 0 ? "1000" : itemList.items[0].tokenId;
            // let tokenId = parseInt(tokenIdBlockchain.replace('0x', ''), 16);
            // if (lastTokenId && lastTokenId.length !== 0) {
            //     if (tokenId < lastTokenId[0].token_id) {
            //         tokenId = parseInt(lastTokenId[0].token_id);
            //     }
            // }
            let tokenId = 0;
            if (lastTokenId.length > 0) {
                tokenId = parseInt(lastTokenId[0].token_id);
            }
            console.log('=======>', lastTokenId, tokenId)

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
            let metadata_ipfs_link;

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
                console.log('----->', i)
                console.log('----->', attributes)
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
                        minted_by: "Talken",
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
                console.log('444444444')
                //thumbnail check
                if (typeof req.files.thumbnail != 'undefined') {
                    metadata_ipfs.thumbnail = ALT_URL + `${collection.contract_address}/thumbnail/` + result.Hash + '_thumbnail.' + thumbName[thumbName.length -1]
                }
                console.log('5555555')
                // let metadata_ipfs_link;
                if (i === 0) {
                    console.log('6666666')
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
                console.log('5555555')
                if (
                    req.body?.status === NFT_STATUS.SUSPEND ||
                    req.body?.status === NFT_STATUS.INACTIVE
                ) {
                    newNft.quantity_selling = 0;
                }

                console.log('1111111')
                // write json file
                await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadata_ipfs), i+1);
                console.log('2222222')
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
            let txHashs = [];
            for (let i = 0; i < tokenIds.length; i++) {
                let to = to_address ?? admin_address;
                let newTokenId = tokenIds[i];
                let tokenUri = ipfs_links[i];
                // mint nft
                // let mintResult = await nftBlockchain._mint(to, newTokenId, tokenUri);
                let mintResult = await nftBlockchain._mint17(collection.contract_address, to, newTokenId, tokenUri);
                console.log('---- mint resule ------->', mintResult)
                if (mintResult.status !== 200 && mintResult.error._code !== 1104400) {
                    // return handlerError(req, res, {error: mintResult.error});
                    console.log('====>', mintResult.error);
                    sleep.sleep(3);
                    i = i - 1;
                    continue;
                } else if (mintResult.status === 200) {
                    txHashs.push(mintResult.result.transactionHash);
                }
            }

            await nftRepository.update(nft._id, {onchain: 'true'});

            console.log('3333333', {...nft._doc, txHashs})
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

            let contract = await nftBlockchain._deploy17(name, symbol, alias);

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

    // Minting NFTs via frontend Metamask
    createNft: async (req, res, next) => {
        try {
            var errors = validationResult(req);
            if (!errors.isEmpty()) {
                let errorMsg = _errorFormatter(errors.array());
                return handlerError(req, res, errorMsg);
            }
            let admin_address = req.body.admin_address;

            let tokenIds = [];
            let ipfs_links = [];

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
            console.log('>> New Token ID = ', newTokenId);

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
            await writeJson(consts.UPLOAD_PATH + "metadata/" + metadata_ipfs_link.Hash + ".json", JSON.stringify(metadata_ipfs), 1);

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

            //serial default
            const newSerial = {
                type: req.body.type,
                ...(req.body?.status && {status: req.body.status}),
                contract_address: collection.contract_address
            };

            if (newNft.type === 1) {
                newNft.price = 0;
            }

            // let nft = await nftRepository.create(newNft, newSerial, tokenIds, ipfs_links);
            let nft = await nftRepository.createByWallet(newNft, newSerial, tokenIds, ipfs_links, collection.contract_type);

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
                    mintResult = await nftBlockchain._mint37(collection.contract_address, to, newTokenId, req.body.quality);
                }
                // update db
                if (mintResult.status !== 200) {
                    return handlerError(req, res, {error: mintResult.error});
                }
                await nftRepository.update(nft.id, {onchain: "true"})
            }

            return handlerSuccess(req, res, nft);
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
                        alt_url: ALT_URL + collection.path.replace('/talkenNft', ''),
                        content_Type: collection.path.split(',')[1],
                        cid: '',
                        tokenId: decimalTokenIds[i],
                        total_minted: "",
                        external_url: req.body.external_url,
                        attributes: attributes,
                        minted_by: creator.full_name,
                        thumbnail: ALT_URL + collection.path.replace('/talkenNft', ''),
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
                const newAmount = parseInt(nft.transfered, 10) + parseInt(amount, 10);
                await nftRepository.update(nft._id, {transfered: newAmount});
                // await serialRepository.updateById(serial._id, {owner_id: tx.buyer});
                let ids = [];
                for (let i = 0; i < amount; i++) {
                    ids.push(serials[i]._id)
                }
                await serialRepository.updateByIds(ids, {owner_id: tx.buyer});
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
    userNFTs: async (req, res, next) => {
        const address = req.query.address;
        let size = req.query.size;
        let cursor = req.query.cursor;

        const transferResult = await nftBlockchain._userNFTs(address, size, cursor);
        if (transferResult.status == 200) {
            return handlerSuccess(req, res, transferResult.data);
        } else {
            return handlerError(req, res, {error: transferResult.response.data});
        }
    },
    sellNFTs: async (req, res, next) => {
        // contract_address, nft_id 를 사용해서 serials 모두 sell 처리
        // nftId check
        const nftId = req.query.nft_id;
        const nft = await nftRepository.findById(nftId);
        if (!nft) {
            return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
        }

        // collectionId check
        const collection = await collectionRepository.findById(nft.collection_id);
        if (!collection) {
            return handlerError(req, res, ErrorMessage.COLLECTION_IS_NOT_FOUND);
        }

        const serials = await serialRepository.findByNftIdNotTRransfered(nftId);
        if (!serials) {
            return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
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
                status: consts.TRANSACTION_STATUS.PROCESSING,
            });
            const transferResult = await nftBlockchain._sellNFT(collection.contract_address, serials[i].token_id, nft.price.toString());
            console.log(transferResult);
            await serialRepository.updateById(serials[i]._id, {owner_id: marketAddress});
            if (transferResult.status === 200) {
                tx.tx_id = transferResult.result;
                tx.date = Date.now();
                tx.updatedAt = Date.now();
                await tx.save();
                readyToSellTokens.push(serials[i].token_id);
                console.log('111');
            } else {
                tx.status = consts.TRANSACTION_STATUS.ERROR;
                tx.date = Date.now();
                tx.updatedAt = Date.now();
                await tx.save();
                failToSellTokens.push(serials[i].token_id);
                console.log('222');
            }
        }
        return handlerSuccess(req, res, {success: readyToSellTokens, fail: failToSellTokens});
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

    if (filters.onchain) {
        findParams.onchain = filters.onchain;
    }

    if (filters.creator_id) {
        findParams.creator_id = filters.creator_id;
    }

    if (filters.collection_id) {
        findParams.collection_id = filters.collection_id;
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
