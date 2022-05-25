const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LastblockSchema = new Schema(
    {
        chain_id: {
            type: String,
            required: true
        },
        type: {
            type: String,
            required: true
        },
        block_number: {
            type: Number,
            required: true
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

module.exports = mongoose.model('Lastblock', LastblockSchema);