const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const TradeSchema = new Schema(
    {
        tx_hash: {
            type: String,
            required: false,
            unique : true
        },
        block_number: {
            type: Number,
            default: 0,
        },
        chain_id: {
            type: String,
            default: 0,
        },
        serial_id: {
            type: Schema.Types.ObjectId,
            ref: 'Serial',
            required: false,
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
        trade_date: {
            type: Date,
            required: false
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
    },
    {usePushEach: true},
);
TradeSchema.index({trade_date: -1, collection_id: 1}, {background: true});

module.exports = mongoose.model('Trade', TradeSchema);
