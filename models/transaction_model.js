const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {TRANSACTION_STATUS} = require('../utils/consts');
const {getValueInEnum} = require('../utils/helper');

const TransactionSchema = new Schema(
    {
        tx_id: {
            type: String,
            required: false,
        },
        serial_id: {
            type: Schema.Types.ObjectId,
            ref: 'Serial',
            required: true,
        },
        seller: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        // buyer: {
        //     type: Schema.Types.ObjectId,
        //     ref: 'User',
        //     default: null,
        // },
        buyer: {
            type: String,
            default: null,
        },
        reward_id: {
            type: Schema.Types.ObjectId,
            ref: 'Reward',
            default: null,
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
        iap_info: {
            type: String,
            default: null
        },
        tp_amount: {
            type: Number,
            default: 0,
        },
        date: {
            type: Date,
        },
        status: {
            type: String,
            enum: getValueInEnum(TRANSACTION_STATUS),
            default: TRANSACTION_STATUS.PENDING,
        },
        contract_id: {
            type: Schema.Types.ObjectId,
            ref: 'Contract',
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
TransactionSchema.index({tx_id: 1}, {background: true});

module.exports = mongoose.model('Transaction', TransactionSchema);
