const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// TODO: 추후 수정할 수 도있음. DB에 직접 contract를 추가하도록 한다.
const ContractSchema = new Schema(
    {
        name: {
            type: String,
        },
        symbol: {
            type: String,
        },
        contract_address: {
            type: String,
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
ContractSchema.index({name: 1}, {background: true});

module.exports = mongoose.model('Contract', ContractSchema);
