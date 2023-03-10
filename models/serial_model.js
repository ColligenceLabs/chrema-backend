const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {SERIAL_STATUS, NFT_TYPE, TRANSFERED} = require('../utils/consts');
const {getValueInEnum} = require('../utils/helper');

const SerialSchema = new Schema(
    {
        nft_id: {
            type: Schema.Types.ObjectId,
            ref: 'Nft',
            required: true,
        },
        // owner_id: {
        //     type: Schema.Types.ObjectId,
        //     ref: 'User',
        //     // required: true,
        //     default: null,
        // },
        tx_id: {
            type: String,
            required: false,
        },
        owner_id: {
            type: String,
            // required: true,
            default: null,
        },
        seller: {
            type: String,
            // required: true,
            default: null,
        },
        buyer: {
            type: String,
            // required: true,
            default: null,
        },
        transfered: {
            type: Number,
            default: TRANSFERED.NOT_TRANSFER,
        },
        token_id: {
            type: String,
            // required: true,
            default: '000000000',
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
        contract_address: {
            type: String
        },
        ipfs_link: {
            type: String,
        },
        image_link: {
            type: String,
        },
        index: {
            type: Number,
            default: 1,
        },
        type: {
            type: Number,
            default: NFT_TYPE.NORMAL,
        },
        status: {
            type: String,
            enum: getValueInEnum(SERIAL_STATUS),
            default: SERIAL_STATUS.INACTIVE,
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
SerialSchema.index({owner_id: 1, nft_id: -1}, {background: true});

module.exports = mongoose.model('Serial', SerialSchema);
