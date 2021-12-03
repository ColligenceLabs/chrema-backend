const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const {USER_STATUS} = require('../utils/consts');

const UserSchema = new Schema(
    {
        address: {
            type: String,
            trim: true,
            default: null,
        },
        uid: {
            type: String,
            trim: true,
            default: null,
            required: true,
        },
        status: {
            type: String,
            enum: USER_STATUS,
            default: USER_STATUS.ACTIVE,
        },
        tp_amount: {
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
UserSchema.index({uid: 1}, {background: true});

module.exports = mongoose.model('User', UserSchema);
