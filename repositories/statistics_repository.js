var {StatisticsModel} = require('../models');
var consts = require('../utils/consts');
var adminRepository = require('./admin_repository');
const {STATISTICS_LINE_FIELD, STATISTICS_CHART_FIELD} = require('../utils/consts');

module.exports = {
    create: async function (input) {
        try {
            let statistics = await StatisticsModel.create(input);
            return statistics;
        } catch (error) {
            return error;
        }
    },

    findLine: async function (findParams) {
        try {
            var statistics = await StatisticsModel.find(findParams, {timeout: true})
                .select(STATISTICS_LINE_FIELD)
                .sort({date: 1});

            return statistics;
        } catch (error) {
            return error;
        }
    },

    findChart: async function (findParams) {
        try {
            var statistics = await StatisticsModel.find(findParams)
                .select(STATISTICS_CHART_FIELD)
                .sort({date: 1})
                .populate({path: 'nft_id', select: 'metadata.name'})
                // .populate({path: 'company_id', select: 'name'})
                .populate({path: 'creator_id', select: 'full_name'})
                .populate({path: 'collection_id', select: 'name'});
            // Do something here
            return statistics;
        } catch (error) {
            return error;
        }
    },

    updateById: async function (id, where) {
        try {
            let statistics = await StatisticsModel.updateOne({_id: id}, {$set: where});
            return statistics;
        } catch (error) {
            return error;
        }
    },

    update: async function (findParams, where) {
        try {
            let statistics = await StatisticsModel.updateMany(findParams, {$set: where});
            return statistics;
        } catch (error) {
            return error;
        }
    },
};
