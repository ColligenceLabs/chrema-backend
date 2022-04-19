const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {getValueInEnum} = require('../utils/helper');

const TradeSchema = new Schema(
    {
        tx_hash: {
            type: String,
            required: false,
        },
        serial_id: {
            type: Schema.Types.ObjectId,
            ref: 'Serial',
            required: true,
        },
        seller: {
            type: String,
            default: null,
        },
        buyer: {
            type: String,
            default: null,
        },
        price: {
            type: Number,
            default: 0,
        },
        fee: {
            type: Number,
            default: 0,
        },
        collection_id: {
            type: Schema.Types.ObjectId,
            ref: 'Collection',
            default: null,
        },
        contract_address: {
            type: String
        },
        token_id: {
            type: String,
            default: '000000000',
        },
        quote: {
            type: String,
            required: false
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {usePushEach: true},
);
TradeSchema.index({createdAt: 1, collection_id: 1}, {background: true});

module.exports = mongoose.model('Trade', TradeSchema);
