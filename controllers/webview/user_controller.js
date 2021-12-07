var logger = require('../../utils/logger');
var serialRepository = require('../../repositories/serial_repository');
var nftRepository = require('../../repositories/nft_repository');
var collectionRepository = require('../../repositories/collection_repository');
var txRepository = require('../../repositories/transaction_repository');
const userRepository = require('../../repositories/user_repository');
var rewardRepository = require('../../repositories/reward_repository');
const adminRepository = require('../../repositories/admin_repository');
const {getHeaders, validateRouter, calcQuantitySellingNumber} = require('../../utils/helper');
var ObjectID = require('mongodb').ObjectID;
var ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
var consts = require('../../utils/consts');
var nftBlockchain = require('../blockchain/nft_controller');
var {v4: uuidv4} = require('uuid');
var {handlerSuccess, handlerError} = require('../../utils/handler_response');

module.exports = {
    classname: 'UserController',
    async nftCollect(req, res, next) {
        const validate = validateRouter(req, res);
        if (validate) {
            return handlerError(req, res, validate);
        }

        try {
            if (ObjectID.isValid(req.body.nft_id) === false) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            // const user = await userRepository.findByUserAddress(req.body.user_address);
            const user = await userRepository.findByUid(req.body.uid);

            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_ADDRESS_IS_INVALID);
            }

            let adminAddress = await adminRepository.getAdminAddress();

            const admin = await adminRepository.findByAdminAddress(adminAddress[0]);
            if (!admin) {
                return handlerError(req, res, ErrorMessage.ADMIN_ADDRESS_IS_INVALID);
            }

            const serial = await serialRepository.findOneSerial({
                status: consts.SERIAL_STATUS.ACTIVE,
                owner_id: null,
                nft_id: req.body.nft_id,
            });

            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            let findReward = {
                remaining_amount: {$gt: 0},
                type: consts.REWARD_TYPE.BUY,
                status: consts.REWARD_STATUS.ACTIVE,
            };

            let reward = await rewardRepository.findByParam(findReward);

            if (!reward.length) {
                reward = [
                    {
                        _id: null,
                        tp_amount: 0,
                    },
                ];
            } else {
                await rewardRepository.updateById(reward[0]._id, {
                    remaining_amount: reward[0].remaining_amount - 1,
                });
            }
            if (!user.tp_amount) {
                user.tp_amount = 0;
            }

            await userRepository.update(user._id, {
                tp_amount: user.tp_amount + reward[0].tp_amount,
            });
            //update serial
            await serialRepository.update(
                {_id: serial._id},
                {owner_id: user._id},
                {tranfered: consts.TRANSFERED.NOT_TRANSFER},
            );

            const newTx = {
                serial_id: serial._id,
                seller: admin.id,
                buyer: user.id,
                price: serial.nft_id.price,
                reward_id: reward[0]._id,
                tp_amount: reward[0].tp_amount,
                // type: type,
                date: Date.now(),
                status: consts.TRANSACTION_STATUS.PROCESSING,
            };

            const tx = await txRepository.createTx(newTx);
            if (!tx) {
                return handlerError(req, res, ErrorMessage.CREATE_TX_IS_NOT_SUCCESS);
            }

            let serialList = await serialRepository.findAllSerialWithCondition({
                nft_id: req.body.nft_id,
                status: consts.SERIAL_STATUS.ACTIVE,
            });
            let quantitySelling = calcQuantitySellingNumber(serialList);
            await nftRepository.update(req.body.nft_id, {
                quantity_selling: quantitySelling,
            });

            return handlerSuccess(req, res, req.body.nft_id);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async transferToWallet(req, res, next) {
        const validate = validateRouter(req, res);
        if (validate) {
            return handlerError(req, res, validate);
        }

        try {
            if (ObjectID.isValid(req.body.nft_id) === false) {
                return handlerError(req, res, ErrorMessage.NFT_IS_NOT_FOUND);
            }

            const user = await userRepository.findByUid(req.body.uid);
            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_ADDRESS_IS_INVALID);
            }

            let adminAddress = await adminRepository.getAdminAddress();

            const admin = await adminRepository.findByAdminAddress(adminAddress[0]);
            if (!admin) {
                return handlerError(req, res, ErrorMessage.ADMIN_ADDRESS_IS_INVALID);
            }

            const serial = await serialRepository.findOneSerial({
                status: consts.SERIAL_STATUS.ACTIVE,
                owner_id: user._id,
                nft_id: req.body.nft_id,
                transfered: consts.TRANSFERED.NOT_TRANSFER,
            });

            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            const tx = await txRepository.findOneTx({
                serial_id: serial._id,
                seller: admin.id,
                buyer: user.id,
                status: consts.TRANSACTION_STATUS.PROCESSING,
            });

            if (!tx) {
                return handlerError(req, res, ErrorMessage.TX_IS_NOT_FOUND);
            }

            // Check response of blockchain
            const transfer = await nftBlockchain._transfer(
                adminAddress[0],
                adminAddress[0],
                req.body.user_address,
                parseInt(serial.token_id, 16),
            );

            // Update owner of serial
            if (transfer.status === 200) {
                tx.tx_id = transfer.result.transactionHash;
                await tx.save();
                return handlerSuccess(req, res, {transaction: transfer.result});
            }

            // Update status of transaction to ERROR
            if (transfer.status !== 200) {
                tx.status = consts.TRANSACTION_STATUS.ERROR;
                await tx.save();
                return handlerError(req, res, {transaction: transfer.error});
            }
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async myCollection(req, res, next) {
        try {
            let address = req.query.address;
            let user = await userRepository.findByUserAddress(address);
            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }

            let findParams = {
                owner_id: user._id,
                transfered: consts.TRANSFERED.NOT_TRANSFER,
            };

            let ownserSerials = await serialRepository.findAllSerialWithCondition(findParams);

            let collectionList = [];

            for (let i = 0; i < ownserSerials.length; i++) {
                if (ownserSerials[i].nft_id.collection_id) {
                    if (!collectionList.includes(ownserSerials[i].nft_id.collection_id)) {
                        collectionList.push(ownserSerials[i].nft_id.collection_id);
                    }
                }
            }

            if (collectionList.length == 0) {
                return handlerError(req, res, ErrorMessage.USER_DOES_NOT_OWN_ANY_NFT);
            }
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            let inputData = {
                _id: {$in: collectionList},
            };

            if (req.query.category) {
                Object.assign(inputData, {category: req.query.category});
            }

            const count = await collectionRepository.count(inputData);
            const responseHeaders = getHeaders(count, page, perPage);

            let collections = await collectionRepository.findAll(inputData, {page, perPage});

            collections = JSON.parse(JSON.stringify(collections));

            for (let i = 0; i < collections.length; i++) {
                let nfts = await nftRepository.findAllNftsByCollectionId(collections[i]._id);
                nfts = JSON.parse(JSON.stringify(nfts));

                for (j = 0; j < nfts.length; j++) {
                    collected = false;

                    for (let z = 0; z < ownserSerials.length; z++) {
                        if (ownserSerials[z].nft_id._id == nfts[j]._id) {
                            collected = true;
                            break;
                        }
                    }

                    nfts[j].collected = collected;
                }

                collections[i].nfts = nfts;
            }

            return handlerSuccess(req, res, {
                items: collections,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            return handlerError(req, res, error);
        }
    },

    async sendSerial(req, res, next) {
        try {
            let serialId = req.body.serial_id;

            var seller = await userRepository.findByUserAddress(req.body.seller);
            if (!seller) {
                return handlerError(req, res, ErrorMessage.USER_ADDRESS_IS_INVALID);
            }

            var buyer = await userRepository.findByUserAddress(req.body.buyer);
            if (!buyer) {
                return handlerError(req, res, ErrorMessage.USER_ADDRESS_IS_INVALID);
            }

            let serial = await serialRepository.findOneSerial({
                _id: serialId,
                status: consts.SERIAL_STATUS.ACTIVE,
                owner_id: seller,
            });
            if (!serial) {
                return handlerError(req, res, ErrorMessage.SERIAL_IS_NOT_FOUND);
            }

            var newTx = {
                serial_id: serialId,
                seller: seller._id,
                buyer: buyer._id,
                price: serial.nft_id.price,
                date: Date.now(),
                status: consts.TRANSACTION_STATUS.PROCESSING,
            };
            let tx = await txRepository.createTx(newTx);
            if (!tx) {
                return handlerError(req, res, ErrorMessage.CREATE_TX_IS_NOT_SUCCESS);
            }

            // Check response of blockchain
            const transfer = await nftBlockchain._transfer(
                consts.ADMIN_ADDRESS,
                seller.address,
                buyer.address,
                parseInt(serial.token_id, 16),
            );

            // Update owner of serial
            if (transfer.status === 200) {
                tx.tx_id = transfer.result.transactionHash;
                tx.status = consts.TRANSACTION_STATUS.PROCESSING;
                await tx.save();
                return handlerSuccess(req, res, {transaction: transfer.result});
            }

            // Update status of transaction to ERROR
            if (transfer.status !== 200) {
                tx.status = consts.TRANSACTION_STATUS.ERROR;
                await tx.save();
                return handlerError(req, res, {transaction: transfer.error});
            }
        } catch (error) {
            logger.error(new Error(error));
            return handlerError(req, res, error);
        }
    },

    createUser: async (req, res, next) => {
        try {
            // user key changed. userAddress -> uid
            // let checkUserIsExist = await userRepository.findByUserAddress(req.body.address);
            let checkUserIsExist = await userRepository.findByUid(req.body.uid);
            if (!checkUserIsExist) {
                let newUser = {
                    address: req.body.address,
                    uid: req.body.uid,
                    status: consts.USER_STATUS.ACTIVE,
                };

                let user = await userRepository.createUser(newUser);
                if (!user) {
                    return handlerError(req, res, ErrorMessage.CREATE_USER_IS_NOT_SUCCESS);
                }

                return handlerSuccess(req, res, user);
            }
            return handlerError(req, res, ErrorMessage.USER_IS_EXISTED);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async myIndividualNFTs(req, res, next) {
        try {
            // let address = req.query.address;
            let uid = req.query.uid;
            // let user = await userRepository.findByUserAddress(address);
            let user = await userRepository.findByUid(uid);
            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }

            let findParams = {
                owner_id: user._id,
                transfered: consts.TRANSFERED.NOT_TRANSFER,
            };

            let ownserSerials = await serialRepository.findAllSerialWithCondition(findParams);

            if (!ownserSerials) {
                return handlerError(req, res, ErrorMessage.USER_DOES_NOT_OWN_ANY_NFT);
            }

            let nftList = [];

            for (let i = 0; i < ownserSerials.length; i++) {
                nftList.push(ownserSerials[i].nft_id);
            }

            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            let inputData = {
                _id: {$in: nftList},
                status: consts.NFT_STATUS.ACTIVE,
                collection_id: null,
            };
            let nfts = await nftRepository.findAll(inputData, {page, perPage});
            const count = await nftRepository.count(inputData);

            const responseHeaders = getHeaders(count, page, perPage);
            return handlerSuccess(req, res, {
                items: nfts,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            return handlerError(req, res, error);
        }
    },

    async myNFTs(req, res, next) {
        try {
            // let address = req.query.address;
            let uid = req.query.uid;
            let page = +req.query.page || 1;
            let perPage = +req.query.perPage || 20;

            // let user = await userRepository.findByUserAddress(address);
            let user = await userRepository.findByUid(uid);
            if (!user) {
                return handlerError(req, res, ErrorMessage.USER_IS_NOT_FOUND);
            }

            let findParams = {
                buyer: user._id,
                status: consts.TRANSACTION_STATUS.PROCESSING,
            };
            let transactions = await txRepository.findTxs(findParams, {page, perPage});

            if (!transactions) {
                return handlerError(req, res, ErrorMessage.USER_DOES_NOT_OWN_ANY_NFT);
            }

            let nftList = [];
            let nfts = [];

            for (let i = 0; i < transactions.length; i++) {
                nftList.push(transactions[i].serial_id.nft_id);
                let nft = await nftRepository.findById(transactions[i].serial_id.nft_id);
                nft = JSON.parse(JSON.stringify(nft));
                nft.own_serial_id = transactions[i].serial_id._id;
                nfts.push(nft);
            }

            const count = await txRepository.count(findParams);
            const responseHeaders = getHeaders(count, page, perPage);

            return handlerSuccess(req, res, {
                items: nfts,
                headers: responseHeaders,
            });
        } catch (error) {
            logger.error(new Error(error));
            return handlerError(req, res, error);
        }
    },
};
