const {TransactionModel, AdminModel, UserModel, SerialModel} = require('../models');
const {addMongooseParam} = require('../utils/helper');

module.exports = {
    findByTxId: async function (id) {
        let tx = await TransactionModel.findOne({_id: id})
            .populate('serial_id')
            .populate({path: 'buyer', select: 'address'});

        if (!tx) {
            return null;
        }
        const userSeller = await UserModel.findOne({_id: tx.seller});
        if (userSeller) {
            tx._doc.seller = {
                address: userSeller.address,
                id: userSeller.id,
            };
        }

        if (!userSeller) {
            const adminSeller = await AdminModel.findOne({_id: tx.seller});
            if (adminSeller) {
                tx._doc.seller = {
                    address: adminSeller.admin_address,
                    id: adminSeller.id,
                };
            }
        }

        return tx;
    },
    findAllTx: async function (findParams, pagination = null) {
        try {
            if (pagination) {
                var txs = await TransactionModel.find(findParams)
                    .skip((pagination.page - 1) * pagination.perPage)
                    .limit(pagination.perPage)
                    .sort({createdAt: -1, _id: 1})
                    .populate('serial_id')
                    .populate({path: 'seller', select: 'admin_address'})
                    .populate({path: 'buyer', select: 'address'});
            } else {
                var txs = await TransactionModel.find(findParams)
                    .sort({createdAt: -1, _id: 1})
                    .populate('serial_id')
                    .populate({path: 'seller', select: 'admin_address'})
                    .populate({path: 'buyer', select: 'address'});
            }

            return txs;
        } catch (error) {
            return error;
        }
    },
    findOneTx: async function (where) {
        let tx = await TransactionModel.findOne(where);

        if (!tx) {
            return null;
        }
        return tx;
    },

    findByBuyerAddress: async function (address) {
        let findParams = {};
        findParams.address = addMongooseParam(findParams.address, '$regex', address);
        try {
            const users = await UserModel.find(findParams).lean();

            const userIds = [];

            users.map((item) => {
                userIds.push(item._id);
            });

            return userIds;
        } catch (error) {
            return null;
        }
    },
    findBySellerAddress: async function (address) {
        let findParams = {};
        let adminFindParams = {};

        findParams.address = addMongooseParam(findParams.address, '$regex', address);
        adminFindParams.admin_address = addMongooseParam(
            findParams.admin_address,
            '$regex',
            address,
        );

        try {
            const users = await UserModel.find(findParams).lean();
            const admins = await AdminModel.find(adminFindParams).lean();

            const ids = [];

            users.map((item) => {
                ids.push(item._id);
            });

            admins.map((item) => {
                ids.push(item._id);
            });

            return ids;
        } catch (error) {
            return null;
        }
    },

    findBySerialTokenIds: async function (tokenId) {
        let findParams = {};

        findParams.token_id = addMongooseParam(findParams.token_id, '$regex', tokenId);

        try {
            const serials = await SerialModel.find(findParams).lean();
            const ids = [];

            serials.map((item) => {
                ids.push(item._id);
            });

            return ids;
        } catch (error) {
            return null;
        }
    },
    count: async function (where) {
        let count = await TransactionModel.countDocuments(where);
        if (!count) {
            return null;
        }
        return count;
    },
    createTx: async function (newTx) {
        let tx = await TransactionModel.create(newTx);
        if (!tx) {
            return null;
        }
        return tx;
    },
    update: async function (id, where) {
        try {
            let tx = await TransactionModel.updateOne({_id: id}, {$set: where});
            return tx;
        } catch (error) {
            return error;
        }
    },

    getTxBybuyer: async function (input) {
        try {
            let txs = await TransactionModel.find(input)
                .sort({createdAt: -1, _id: 1})
                .populate('serial_id')
                .populate({path: 'seller', select: 'admin_address'})
                .populate({path: 'buyer', select: 'address'});
            return txs;
        } catch (error) {
            return error;
        }
    },

    getTxByseller: async function (seller) {
        try {
            let txs = await TransactionModel.find({seller: seller})
                .sort({createdAt: -1, _id: 1})
                .populate('serial_id')
                .populate({path: 'seller', select: 'admin_address'})
                .populate({path: 'buyer', select: 'address'});
            return txs;
        } catch (error) {
            return error;
        }
    },

    findTxs: async function (findParams, pagination = null) {
        try {
            if (pagination) {
                var txs = await TransactionModel.find(findParams)
                    .skip((pagination.page - 1) * pagination.perPage)
                    .limit(pagination.perPage)
                    .sort({createdAt: -1})
                    .populate('serial_id')
                    .populate({path: 'seller', select: 'admin_address'})
                    .populate({path: 'buyer', select: 'address'});
                return txs;
            } else {
                var txs = await TransactionModel.find(findParams)
                    .sort({createdAt: -1})
                    .populate('serial_id')
                    .populate({path: 'seller', select: 'admin_address'})
                    .populate({path: 'buyer', select: 'address'});
                return txs;
            }
        } catch (error) {
            return error;
        }
    },
};
