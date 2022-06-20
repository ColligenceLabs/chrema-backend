const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {NFT_STATUS, NFT_TYPE, COLLECTION_CATE, SELLING_STATUS} = require('../utils/consts');
const {getValueInEnum, getCollectionCateValueInEnum} = require('../utils/helper');

const OfferSchema = new Schema(
    {
        bidder: {
            type: String,
            required: true
        },
        buyer: {
            type: String,
            required: false
        },
        quantity: {
            type: Number,
            required: true,
            default: 1,
        },
        price: {
            type: Number,
            required: true
        },
        quote: {
            type: String,
            required: false,
            default: 'talk'
        },
        picked: {
            type: Boolean,
            required: false,
            default: false
        },
        collection_id: {
            type: Schema.Types.ObjectId,
            ref: 'Collection',
            required: false,
        },
        nft_id: {
            type: Schema.Types.ObjectId,
            ref: 'Nft',
            required: false,
        },
        token_id: {
            type: String,
            default: '000000000',
        },
        expiration: {
            type: Date,
            default: null,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {usePushEach: true},
);

module.exports = mongoose.model('Offer', OfferSchema);
