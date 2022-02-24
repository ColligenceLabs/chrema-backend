const {ListenerModel} = require('../models');
// var mongoose = require('mongoose');
// var consts = require('../utils/consts');

module.exports = {
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
