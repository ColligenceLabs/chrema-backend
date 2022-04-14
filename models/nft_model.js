const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {NFT_STATUS, NFT_TYPE, COLLECTION_CATE, SELLING_STATUS} = require('../utils/consts');
const {getValueInEnum, getCollectionCateValueInEnum} = require('../utils/helper');

const NftSchema = new Schema(
    {
        metadata: {
            type: Schema.Types.Mixed,
            // required: true,
            default: null,
        },
        ipfs_link: {
            type: String,
        },
        metadata_link: {
            type: String,
        },
        // ipfs_links: {
        //     type: Schema.Types.Mixed,
        //     default: null,
        // },
        quantity: {
            type: Number,
            required: false,
            default: 1,
        },
        quantity_selling: {
            type: Number,
            default: 1,
        },
        price: {
            type: Number,
            default: 0,
        },
        quote: {
            type: String,
            required: false,
            default: 'talk'
        },
        name: {
            type: String,
        },
        description: {
            type: String,
            required: false,
            trim: true,
        },
        category: {
            type: [
                {
                    type: String,
                    enum: getCollectionCateValueInEnum(COLLECTION_CATE),
                },
            ],
            default: [COLLECTION_CATE.OTHER.value],
        },
        company_id: {
            type: Schema.Types.ObjectId,
            ref: 'Company',
            required: false,
        },
        creator_id: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
            required: false,
        },
        collection_id: {
            type: Schema.Types.ObjectId,
            ref: 'Collection',
            required: false,
        },
        onchain: {
            type: String,
            required: true,
            trim: true,
            default: 'false',
        },
        rarity: {
            type: Number,
            required: false,
            trim: true,
        },
        contract_id: {
            type: Schema.Types.ObjectId,
            ref: 'Contract',
        },
        start_date: {
            type: Date,
            default: null,
        },
        end_date: {
            type: Date,
            default: null,
        },
        type: {
            type: Number,
            default: NFT_TYPE.NORMAL,
        },
        selling_status: {
            type: Number,
            default: SELLING_STATUS.SELL,
        },
        transfered: {
            type: Number,
            default: 0,
        },
        status: {
            type: String,
            enum: getValueInEnum(NFT_STATUS),
            default: NFT_STATUS.INACTIVE,
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
NftSchema.index({'metadata.name': 1, status: -1}, {background: true});

module.exports = mongoose.model('Nft', NftSchema);
