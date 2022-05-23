const {WalletModel} = require('../models');

module.exports = {
    createWallet: async function (profileId, address, chainId) {
        try {
            const wallet = await WalletModel.create({profile_id: profileId, wallet_address: address, chain_id: chainId});
            return wallet;
        } catch (error) {
            return error;
        }
    },

    findById: async function (id) {
        const wallet = await WalletModel.findOne({_id: id});
        if (!wallet) {
            return null;
        }
        return wallet;
    },

    find: async function (address, chain_id) {
        try {
            const wallets = await WalletModel.findOne({wallet_address: address, chain_id}).populate('profile_id');
            return wallets;
        } catch (error) {
            return null;
        }
    },

    findByProfileId: async function (profileId) {
        try {
            const wallets = await WalletModel.find({profile_id: profileId});
            return wallets;
        } catch (error) {
            return null;
        }
    },
};
