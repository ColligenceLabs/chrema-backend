const {ListenerModel} = require('../models');
// var mongoose = require('mongoose');
// var consts = require('../utils/consts');

module.exports = {
    findByNftId: async function (nftId, types, page, size) {
        try {
            const where = {nft_id: nftId};
            if (types) {
                types = types.split(',');
                where.type = {$in: types};
            }
            let listener = await ListenerModel
                .find(where, {timeout: false})
                .skip((page-1)*size).limit(size).sort({block_date: -1});
            return listener;
        } catch (error) {
            return error;
        }
    },
    count: async function(nftId, types) {
        try {
            const where = {nft_id: nftId};
            if (types) {
                types = types.split(',');
                where.type = {$in: types};
            }

            const count = await ListenerModel.countDocuments(where);
            return count;
        } catch (e) {
            return e;
        }
    },
    findLastTokenId: async function () {
        try {
            let listener = await ListenerModel.find({type: 1}).limit(1).sort({token_id: -1});
            return listener;
        } catch (error) {
            return error;
        }
    },
    findLastTokenOfAddress: async function (address) {
        try {
            // type = 1 : Mint
            let listener = await ListenerModel.find({type: 1, contract_address: address}).limit(1).sort({_id: -1, token_id: -1});
            return listener;
        } catch (error) {
            return error;
        }
    },
    create: async function (inputData) {
        try {
            let listener = await ListenerModel.create(inputData);
            return listener;
        } catch (error) {
            return error;
        }
    },
};
