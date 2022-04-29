const {SaleModel} = require('../models');

module.exports = {
    findByNftId: async function(nftId) {
        try {
            const sales = await SaleModel.find({nft_id: nftId});
            return sales;
        } catch (e) {
            return e;
        }
    },
    createSale: async function(sale) {
        const result = await SaleModel.create(sale);
        if (!result)
            return null;
        else
            return result;
    }
}