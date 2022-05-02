const {SerialModel, UserModel, AdminModel, TransactionModel} = require('../models');
var nftBlockchain = require('../controllers/blockchain/nft_controller');
var mongoose = require('mongoose');
var consts = require('../utils/consts');

module.exports = {
    findByIdSerial: async function (id) {
        let serial = await SerialModel.findOne({_id: id})
            // .populate({
            //     path: 'owner_id',
            //     select: 'uid',
            // })
            .populate({
                path: 'nft_id',
                select: 'metadata',
            });
        if (!serial) {
            return null;
        }
        return serial;
    },
    findOneSerial: async function (where) {
        let serial = await SerialModel.findOne(where)
            .sort({createdAt: -1, _id: 1})
            .populate({path: 'nft_id'});
        if (!serial) {
            return null;
        }
        return serial;
    },
    findOneSerialDetail: async function (where) {
        let serial = await SerialModel.findOne(where)
            .sort({createdAt: -1, _id: 1})
            .populate({path: 'nft_id', populate: {path: 'collection_id'}});
        if (!serial) {
            return null;
        }
        return serial;
    },
    findAll: async function (findParams, pagination) {
        try {
            let serials = await SerialModel.find(findParams)
                .skip((pagination.page - 1) * pagination.perPage)
                .limit(pagination.perPage)
                .sort({createdAt: -1, _id: 1})
                .populate({path: 'nft_id', select: 'metadata'})
                // .populate({path: 'owner_id', select: 'uid'});
            return serials;
        } catch (error) {
            return error;
        }
    },

    findAllSerialWithCondition: async function (findParams) {
        try {
            let serials = await SerialModel.find(findParams)
                .populate({
                    path: 'nft_id',
                })
                // .populate({
                //     path: 'owner_id',
                //     select: 'uid',
                // });
            return serials;
        } catch (error) {
            return error;
        }
    },
    findAllWithArrayIds: async function (ids) {
        try {
            let serials = await SerialModel.find({_id: {$in: ids}});
            return serials;
        } catch (error) {
            return error;
        }
    },
    findByOwnerId: async function (ownerId) {
        try {
            let serials = await SerialModel.find({owner_id: ownerId})
                .sort({createdAt: -1, _id: 1})
                .populate({path: 'nft_id', select: ['metadata', 'collection_id']})
                // .populate({path: 'owner_id', select: 'uid'});
            return serials;
        } catch (error) {
            return error;
        }
    },
    findByOwnerId: async function (ownerId, page, size) {
        try {
            let serials = await SerialModel.find({$or: [{owner_id: ownerId}, {seller: ownerId}]})
                .sort({createdAt: -1, _id: 1})
                .skip(page * size)
                .limit(size)
                .populate({path: 'nft_id', populate: {path: 'collection_id', select: 'name'}});
            return serials;
        } catch (error) {
            return error;
        }
    },
    findByOwnerIdAndNftId: async function (ownerId, nftId) {
        try {
            let serials = await SerialModel.find({owner_id: ownerId, nft_id: nftId})
                .sort({index: 1, _id: 1});
            // .populate({path: 'owner_id', select: 'uid'});
            return serials;
        } catch (error) {
            return error;
        }
    },
    findFloorPrice: async function (contract_address) {
        try {
            // let serial = await SerialModel.findOne({status: consts.SERIAL_STATUS.SELLING, contract_address})
            //     .sort({price: 1});
            let prices = SerialModel.aggregate([
                {$match: {contract_address: contract_address}},
                {$group: {_id: '$quote', floorPrice: {$min: '$price'}}},
                {$sort: {_id: -1}}
            ])
            // .populate({path: 'owner_id', select: 'uid'});
            return prices;
        } catch (error) {
            return error;
        }
    },
    findByNftId: async function (nftId) {
        try {
            let serials = await SerialModel.find({nft_id: nftId})
                .sort({createdAt: -1, _id: 1})
                .populate({path: 'nft_id', select: 'metadata'})
                // .populate({path: 'owner_id', select: 'uid'});
            return serials;
        } catch (error) {
            return error;
        }
    },
    findByNftIdAndUpdate: async function (nftId, buyer, amount) {
        try {
            const serials = await SerialModel.find({nft_id: nftId, status: consts.SERIAL_STATUS.SELLING})
                .sort({createdAt: 1, _id: 1})
                .limit(amount);
            const serialIds = serials.map((doc) => doc._id);
            const result = await SerialModel.updateMany({_id: {$in: serialIds}}, {$set: {buyer, status: consts.SERIAL_STATUS.BUYING, updatedAt: Date.now()}});
            return serials;
        } catch (error) {
            return error;
        }
    },
    findByNftIdNotTRransfered: async function (nftId) {
        try {

            let serials = await SerialModel.find({nft_id: nftId, transfered: 0})
                .sort({createdAt: 1, index: 1})
                // .sort({token_id: 1})     // 오류 : 0x1 -> 0x10 (not 0ㅌ2)
                // .populate({path: 'nft_id', select: 'metadata'})
                // .populate({path: 'owner_id', select: 'uid'});
            return serials;
        } catch (error) {
            return error;
        }
    },

    count: async function (where) {
        try {
            let count = await SerialModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },
    create: async function (input) {
        try {
            let newSerial = {
                owner_id: null,
                ...input,
            };
            let serial = await SerialModel.create(newSerial);
            return serial;
        } catch (error) {
            return error;
        }
    },
    createWithOwner: async function (input, owner) {
        try {
            let newSerial = {
                owner_id: owner,
                ...input,
            };
            let serial = await SerialModel.create(newSerial);
            return serial;
        } catch (error) {
            return error;
        }
    },
    updateById: async function (id, where) {
        try {
            let serial = await SerialModel.updateOne({_id: id}, {$set: where});
            session.endSession();
            return serial;
        } catch (error) {
            return error;
        }
    },
    updateByIds: async function (ids, where) {
        try {
            let serial = await SerialModel.updateMany({_id: {$in: ids}}, {$set: where});
            session.endSession();
            return serial;
        } catch (error) {
            return error;
        }
    },
    update: async function (findParams, where) {
        try {
            let serial = await SerialModel.updateMany(findParams, {$set: where});
            return serial;
        } catch (error) {
            return error;
        }
    },
    delete: async function (ownerId, tokenId, id, admin_address) {
        try {
            if (!ownerId) {
                ownerId = admin_address[0];
            }
            let burnResult = await nftBlockchain._burn(
                ownerId,
                parseInt(tokenId.replace('0x', ''), 16),
            );
            if (burnResult.status !== 200) {
                return {
                    error: burnResult.error,
                    status: burnResult.status,
                };
            } else {
                await SerialModel.updateOne(
                    {_id: id},
                    {
                        status: consts.SERIAL_STATUS.SUSPEND,
                    },
                );

                return {
                    message: burnResult.result,
                    status: burnResult.status,
                };
            }
        } catch (error) {
            return error;
        }
    },
    deleteMany: async function (ids, admin_address) {
        try {
            let result = [];
            await SerialModel.updateMany(
                {_id: {$in: ids}},
                {
                    status: consts.SERIAL_STATUS.SUSPEND,
                },
            );
            for (let i = 0; i < ids.length; i++) {
                let serial = await module.exports.findByIdSerial(ids[i]);
                let ownerId = serial.owner_id;
                let tokenId = serial.token_id;
                if (!ownerId) {
                    ownerId = admin_address[0];
                }
                let burnResult = await nftBlockchain._burn(
                    ownerId,
                    parseInt(tokenId.replace('0x', ''), 16),
                );
                if (burnResult.status !== 200) {
                    return burnResult.error;
                }
                result.push(burnResult.result);
            }
            return result;
        } catch (error) {
            return error;
        }
    },

    sendSerial: async function (data) {
        var session = await mongoose.startSession();
        try {
            let serial = await SerialModel.updateOne(
                {_id: data.serial_id},
                {$set: data.update_serial},
            ).session(session);
            let tx = await TransactionModel.updateOne(
                {_id: data.tx_id},
                {$set: data.update_transaction},
            ).session(session);
            session.endSession();
            return tx;
        } catch (error) {
            return error;
        }
    },
};
