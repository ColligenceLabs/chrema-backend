const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {COLLECTION_CATE, COLLECTION_STATUS} = require('../utils/consts');
const {getValueInEnum, getCollectionCateValueInEnum} = require('../utils/helper');

const CollectionSchema = new Schema(
    {
        network: {
            type: String,
            trim: true,
            default: 'klaytn'
        },
        name: {
            type: String,
            required: true,
            trim: true,
        },
        logo_image: {
            type: String,
            required: false,
        },
        cover_image: {
            type: String,
            required: true,
        },
        image_link: {
            type: String,
            required: false,
        },
        optional_images: {
            type: [
                {
                    type: String
                }
            ],
            default: []
        },
        path: {
            type: String,
            required: false,
        },
        url: {
            type: String,
            required: false,
        },
        category: {
            type: [
                {
                    type: String,
                    enum: getCollectionCateValueInEnum(COLLECTION_CATE),
                },
            ],
            default: [COLLECTION_CATE.NFTPROJECT.value],
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
        contract_address: {
            type: String,
            required: true,
            trim: true,
        },
        contract_type: {
            type: String,
            required: true,
            trim: true,
        },
        directory: {
            type: String,
            required: false,
            trim: true,
        },
        description: {
            type: String,
            required: false,
            trim: true,
        },
        maximum_supply: {
            type: Number,
            required: false,
            default: 0
        },
        fee_percentage: {
            type: Number,
            required: false,
            default: 0
        },
        fee_payout: {
            type: String,
            required: false,
            trim: true,
        },
        symbol: {
            type: String,
            required: false,
            trim: true,
        },
        status: {
            type: String,
            enum: getValueInEnum(COLLECTION_STATUS),
            default: COLLECTION_STATUS.ACTIVE,
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

module.exports = mongoose.model('Collection', CollectionSchema);
