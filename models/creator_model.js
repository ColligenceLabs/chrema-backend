var mongoose = require('mongoose');
var {CREATOR_STATUS} = require('../utils/consts');
var {getValueInEnum} = require('../utils/helper');
var Schema = mongoose.Schema;

const CreatorSchema = new Schema(
    {
        email: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            // match: [/.+@.+\..+/, 'Địa chỉ email không hợp lệ'],
        },
        name: {
            type: String,
        },
        description: {
            type: String,
        },
        image: {
            type: String,
        },
        status: {
            type: String,
            enum: getValueInEnum(CREATOR_STATUS),
            default: CREATOR_STATUS.INACTIVE,
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

module.exports = mongoose.model('Creator', CreatorSchema);
