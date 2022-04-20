const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const DayTradeSchema = new Schema(
    {
        collection_id: {
            type: Schema.Types.ObjectId,
            ref: 'Collection',
            default: null,
        },
        day_start_unix: {
            type: Number,
            default: 0,
        },
        total_volume: {
            type: Number,
            default: 0,
        },
        total_volume_usd: {
            type: Number,
            default: 0,
        },
        total_volume_won: {
            type: Number,
            default: 0,
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
DayTradeSchema.index({day_start_unix: -1, collection_id: 1}, {background: true});

module.exports = mongoose.model('dayTradeData', DayTradeSchema);
