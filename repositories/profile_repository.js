const {ProfileModel, WalletModel} = require('../models');
const {USER_FIELD, SERIAL_STATUS} = require('../utils/consts');
const {addMongooseParam} = require('../utils/helper');
const mongoose = require('mongoose');

module.exports = {
    createProfile: async function () {
        try {
            const profile = await ProfileModel.create({name: 'Unnamed'});
            return profile;
        } catch (error) {
            console.log(error);
            return error;
        }
    },

    update: async function (address, chainId, profile) {
        try {
            // wallet model에서 profile id 찾기
            const wallet = await WalletModel.findOne({wallet_address: address, chain_id: chainId});
            if (!wallet) {
                return;
            }
            // profile id 로 profile 업데이트
            const profile = await ProfileModel.findOneAndUpdate({_id: wallet.profile_id}, {$set: profile});
            return profile;
        } catch (error) {
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
