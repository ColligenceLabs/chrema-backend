const {UserModel, SerialModel} = require('../models');
const {USER_FIELD, SERIAL_STATUS} = require('../utils/consts');
const {addMongooseParam} = require('../utils/helper');
const mongoose = require('mongoose');

module.exports = {
    createUser: async function (newUser) {
        try {
            const user = await UserModel.findOne({address: newUser.address}).select(USER_FIELD);
            if (!user) {
                const user = await UserModel.create(newUser);
                return {
                    _id: user.id,
                    status: user.status,
                    address: user.address || '-',
                    createdAt: user.createdAt,
                    updatedAt: user.updatedAt,
                };
            }
        } catch (error) {
            return error;
        }
    },
    findById: async function (id) {
        const user = await UserModel.findOne({_id: id}).select(USER_FIELD);
        if (!user) {
            return null;
        }
        return user;
    },
    findIdsUserByAddress: async function (address) {
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

    findByUserAddress: async function (address) {
        const user = await UserModel.findOne({address: address}).select(USER_FIELD);
        if (!user) {
            return null;
        }
        return user;
    },

    findAll: async function (findParams, pagination) {
        try {
            let users = await UserModel.find(findParams)
                .select(USER_FIELD)
                .skip((pagination.page - 1) * pagination.perPage)
                .limit(pagination.perPage)
                .sort({createdAt: -1, _id: 1});
            return users;
        } catch (error) {
            return error;
        }
    },
    findAllWithArrayIds: async function (ids) {
        try {
            let users = await UserModel.find({_id: {$in: ids}});
            return users;
        } catch (error) {
            return error;
        }
    },
    count: async function (where) {
        try {
            let count = await UserModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },
    update: async function (id, where) {
        try {
            let user = await UserModel.updateOne({_id: id}, {$set: where});
            return user;
        } catch (error) {
            return error;
        }
    },
    delete: async function (id, where) {
        try {
            let user = await UserModel.updateOne({_id: id}, {$set: where});
            await SerialModel.updateMany({owner_id: id}, {$set: {status: SERIAL_STATUS.SUSPEND}});
            return user;
        } catch (error) {
            return error;
        }
    },
    deleteMany: async function (ids, where) {
        try {
            const sess = await mongoose.startSession();
            const users = await UserModel.updateMany(
                {_id: {$in: ids}},
                {$set: where},
                {multi: true},
            ).session(sess);
            await SerialModel.updateMany(
                {owner_id: {$in: ids}},
                {$set: {status: SERIAL_STATUS.SUSPEND}},
                {multi: true},
            ).session(sess);
            sess.endSession();
            return users;
        } catch (error) {
            return error;
        }
    },
};
