const {SaleModel} = require('../models');

module.exports = {
    findByNftId: async function(nftId, page, size) {
        try {
            const sales = await SaleModel.find({nft_id: nftId, sold: 0}).skip((page-1)*size).sort({price: 1}).limit(size);
            return sales;
        } catch (e) {
            console.log(e);
            return e;
        }
    },
    findById: async function(saleId) {
        try {
            const sale = await SaleModel.findOne({_id: saleId});
            return sale;
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
    deleteSale: async function(id, seller) {
        const result = await SaleModel.deleteOne({_id: id, seller});
        return result;
    },
    findOneAndUpdate: async function(findParams, where) {
        const result = await SaleModel.findOneAndUpdate(findParams, where);
        return result;
    },
    count: async function(nftId) {
        try {
            return await SaleModel.countDocuments({nft_id: nftId, sold: 0});
        } catch (e) {
            return e;
        }
    }
}