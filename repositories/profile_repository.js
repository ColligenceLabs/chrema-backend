const {ProfileModel, WalletModel} = require('../models');

module.exports = {
    createProfile: async function (admin_id) {
        try {
            const profile = await ProfileModel.create({name: 'Unnamed', is_creator: true, admin_id});
            return profile;
        } catch (error) {
            console.log(error);
            return error;
        }
    },

    update: async function (id, data) {
        try {
            // profile id 로 profile 업데이트
            const profile = await ProfileModel.findOneAndUpdate({_id: id}, {$set: data}, {returnDocument: "after"});
            return profile;
        } catch (error) {
            console.log(error);
            return error;
        }
    },

    findById: async function (id) {
        const profile = await ProfileModel.findOne({_id: id});
        if (!profile) {
            return null;
        }
        return profile;
    },

    findByAdminId: async function (id) {
        const profile = await ProfileModel.findOne({admin_id: id});
        if (!profile) {
            return null;
        }
        return profile;
    },

    findProfileByWalletAddress: async function (address, chainId) {
        try {
            const wallet = await WalletModel.findOne({wallet_address: address, chain_id: chainId}).populate('profile_id');

            return wallet.profile_id;
        } catch (error) {
            return null;
        }
    },

    findAll: async function (findParams, pagination) {
        try {
            let profiles = await ProfileModel.find(findParams)
                .skip((pagination.page - 1) * pagination.perPage)
                .limit(pagination.perPage)
                .sort({createdAt: -1, _id: 1});
            return profiles;
        } catch (error) {
            return error;
        }
    },

    count: async function (where) {
        try {
            let count = await ProfileModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },

    delete: async function (profileId) {
        try {
            // wallet 삭제
            let result = await WalletModel.deleteMany({profile_id: profileId});

            // profile 삭제
            result = await ProfileModel.deleteOne({_id: profileId});
            return result;
        } catch (error) {
            return error;
        }
    },
};
