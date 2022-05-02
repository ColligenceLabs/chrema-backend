const {SaleModel} = require('../models');

module.exports = {
    findByNftId: async function(nftId, page, size) {
        try {
            const sales = await SaleModel.find({nft_id: nftId}).skip((page-1)*size).sort({price: 1}).limit(size);
            return sales;
        } catch (e) {
            console.log(e);
            return e;
        }
    },
    createSale: async function(sale) {
        const result = await SaleModel.create(sale);
        if (!result)
            return null;
        else
            return result;
    },
    count: async function() {
        try {
            return await SaleModel.countDocuments();
        } catch (e) {
            return e;
        }
    }
}