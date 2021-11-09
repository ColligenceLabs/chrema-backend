var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var {REWARD_STATUS, REWARD_TYPE} = require('../utils/consts');
var {getValueInEnum} = require('../utils/helper');

const RewardSchema = new Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        description: {
            type: String,
            default: null,
        },
        tp_amount: {
            type: Number,
            default: 0,
        },
        quantity: {
            type: Number,
            default: 1,
        },
        remaining_amount: {
            type: Number,
            default: 1,
        },
        type: {
            type: Number,
            default: REWARD_TYPE.TRANSFER,
        },
        status: {
            type: String,
            enum: getValueInEnum(REWARD_STATUS),
            default: REWARD_STATUS.ACTIVE,
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

module.exports = mongoose.model('Reward', RewardSchema);
