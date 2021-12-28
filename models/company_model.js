var mongoose = require('mongoose');
var {COMPANY_STATUS} = require('../utils/consts');
var {getValueInEnum} = require('../utils/helper');
var Schema = mongoose.Schema;

const CompanySchema = new Schema(
    {
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
            enum: getValueInEnum(COMPANY_STATUS),
            default: COMPANY_STATUS.ACTIVE,
        },
        contract_id: {
            type: String,
            ref: 'Contract',
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

module.exports = mongoose.model('Company', CompanySchema);
