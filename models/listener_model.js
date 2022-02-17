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
        contract_id: {
            type: Schema.Types.ObjectId,
            ref: 'Contract',
        },
        collection_id: {
            type: Schema.Types.ObjectId,
            ref: 'Collection',
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
