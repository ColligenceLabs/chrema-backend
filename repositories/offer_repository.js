const { OfferModel } = require('../models');

module.exports = {
    findByNftId: async function(nftId, page, size) {
        try {
            const offers = await OfferModel.find({nft_id: nftId, sold: 0}).skip((page-1)*size).sort({price: 1, quantity: 1}).limit(size);
            return offers;
        } catch (e) {
            console.log(e);
            return e;
        }
    },
    findById: async function(offerId) {
        try {
            const offer = await OfferModel.findOne({_id: offerId});
            return offer;
        } catch (e) {
            console.log(e);
            return e;
        }
    },
    createOffer: async function(offer) {
        const result = await OfferModel.create(offer);
        if (!result)
            return null;
        else
            return result;
    },
    deleteOffer: async function(id, bidder) {
        const result = await OfferModel.deleteOne({_id: id, bidder});
        return result;
    },
    findOneAndUpdate: async function(findParams, where) {
        const result = await OfferModel.findOneAndUpdate(findParams, where);
        return result;
    },
    count: async function(nftId) {
        try {
            return await OfferModel.countDocuments({nft_id: nftId, sold: 0});
        } catch (e) {
            return e;
        }
    }
}
