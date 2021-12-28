const {ContractModel} = require('../models');

module.exports = {
    findByName: async function (name) {
        let contract = await ContractModel.findOne({name: name});
        if (!contract) {
            return null;
        }
        return contract;
    },
    findBySymbol: async function (symbol) {
        let contract = await ContractModel.findOne({symbol: symbol});
        if (!contract) {
            return null;
        }
        return contract;
    },
    findByContractAddress: async function (contractAddress) {
        let contract = await ContractModel.findOne({contract_address: contractAddress});
        if (!contract) {
            return null;
        }
        return contract;
    },
};
