const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const WalletSchema = new Schema(
    {
        profile_id: {
            type: Schema.Types.ObjectId,
            ref: 'Profile',
            required: true,
        },
        wallet_address: {
            type: String,
            required: true
        },
        chain_id: {
            type: String,
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
WalletSchema.index({wallet_address: 1}, {background: true});

module.exports = mongoose.model('Wallet', WalletSchema);