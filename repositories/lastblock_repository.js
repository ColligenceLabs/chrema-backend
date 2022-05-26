const {LastblockModel} = require('../models');

module.exports = {
    create: async function (chainId, type, blockNumber) {
        try {
            const lastblock = await LastblockModel.create({chain_id: chainId, type, block_number: blockNumber});
            return lastblock;
        } catch (error) {
            return error;
        }
    },

    find: async function (chainId, type) {
        const lastblock = await LastblockModel.findOne({chain_id: chainId, type}).select('block_number');
        if (!lastblock) {
            return null;
        }
        return lastblock.block_number;
    },

    update: async function (chainId, type, lastblock) {
        try {
            const wallets = await LastblockModel.findOneAndUpdate({chain_id: chainId, type}, {$set: {block_number: lastblock}});
            return wallets;
        } catch (error) {
            return null;
        }
    }
};
