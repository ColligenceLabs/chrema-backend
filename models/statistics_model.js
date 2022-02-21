const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const StatisticsSchema = new Schema(
    {
        type: {
            type: String,
            required: true,
            trim: true,
        },
        name: {
            type: String,
            trim: true,
        },
        nft_id: {
            type: Schema.Types.ObjectId,
            ref: 'Nft',
            // type: String,
            default: null,
        },
        // company_id: {
        //     type: Schema.Types.ObjectId,
        //     ref: 'Company',
        //     default: null,
        // },
        creator_id: {
            type: Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
        collection_id: {
            type: Schema.Types.ObjectId,
            ref: 'Collection',
            default: null,
        },
        value: {
            type: Number,
            default: 0,
        },
        date: {
            type: Date,
            required: true,
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

module.exports = mongoose.model('Statistics', StatisticsSchema);
