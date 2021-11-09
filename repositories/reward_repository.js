var { RewardModel } = require('../models');
var consts = require('../utils/consts');

module.exports = {
    findById: async function (id) {
        let reward = await RewardModel.findOne({ _id: id });
        if (!reward) {
            return null;
        }
        return reward;
    },

    findAll: async function (findParams, pagination) {
        try {
            let reward = await RewardModel.find(findParams)
                .skip((pagination.page - 1) * pagination.perPage)
                .limit(pagination.perPage)
                .sort({'status': 1})
            return reward;
        } catch (error) {
            return error;
        }
    },

    create: async function (input) {
        try {
            let reward = await RewardModel.create(input);
            return reward;
        } catch (error) {
            return error;
        }
    },

    updateById: async function (id, where) {
        try {
            let reward = await RewardModel.updateOne({ _id: id }, { $set: where });
            return reward;
        } catch (error) {
            return error;
        }
    },

    activeReward: async function(id, type) {
        try {
            let reward = await RewardModel.updateOne({ _id: id }, {
                status: consts.REWARD_STATUS.ACTIVE,
            });
            let rewards = await RewardModel.updateMany({ _id: { $nin: id }, type: type }, {
                status: consts.REWARD_STATUS.INACTIVE,
            });

            return [reward, rewards];
        } catch (error) {
            return error;
        }
    },

    inactiveReward: async function (id) {
        try {
            let reward = await RewardModel.updateOne({ _id: id }, {
                status: consts.REWARD_STATUS.INACTIVE,
            });

            return reward;
        } catch (error) {
            return error;
        }
    },

    findByParam: async function(input) {
        let reward = await RewardModel.find(input)
            .sort('-createdAt');
        if (!reward) {
            return null;
        }
        return reward;
    },

    count: async function (where) {
        try {
            let count = await RewardModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },
};
