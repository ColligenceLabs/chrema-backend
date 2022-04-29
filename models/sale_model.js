const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {NFT_STATUS, NFT_TYPE, COLLECTION_CATE, SELLING_STATUS} = require('../utils/consts');
const {getValueInEnum, getCollectionCateValueInEnum} = require('../utils/helper');

const SaleSchema = new Schema(
    {
        seller: {
            type: String,
            required: true
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
        sold: {
            type: Number,
            required: false,
            default: 0
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

module.exports = mongoose.model('Sale', SaleSchema);