const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const ProfileSchema = new Schema(
    {
        name: {
            type: String,
            trim: true,
            default: 'Unnamed',
        },
        email: {
            type: String,
            trim: true,
            default: null,
        },
        is_creator: {
            type: Boolean,
            default: false,
        },
        image: {
            type: String,
            default: null,
        },
        banner: {
            type: String,
            default: null,
        },
        description: {
            type: String,
            default: null,
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

module.exports = mongoose.model('Profile', ProfileSchema);
