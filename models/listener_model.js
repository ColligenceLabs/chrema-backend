const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ListenerSchema = new Schema(
    {
        token_id: {
            type: String,
            required: true,
        },
        type: {
            type: Number,
            require: true,
        },
        tx_id: {
            type: String,
            required: true,
        },
        contract_address: {
            type: String,
            required: false,
        },
        nft_id: {
            type: Schema.Types.ObjectId,
            ref: 'Nft',
        },
        from: {
            type: String,
            default: null,
        },
        to: {
            type: String,
            default: null,
        },
        quantity: {
            type: Number,
            default: 0,
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
        block_number: {
            type: Number,
            default: 0,
        },
        block_date: {
            type: Date,
            required: false
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
ListenerSchema.index({token_id: 1}, {background: true});

module.exports = mongoose.model('Listener', ListenerSchema);
