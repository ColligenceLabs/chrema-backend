const statisticsRepository = require('../../repositories/statistics_repository');
const adminRepository = require('../../repositories/admin_repository');
const collectionRepository = require('../../repositories/collection_repository');
const companyRepository = require('../../repositories/company_repository');
const nftRepository = require('../../repositories/nft_repository');
const txRepository = require('../../repositories/transaction_repository');
const serialRepository = require('../../repositories/serial_repository');
const ErrorMessage = require('../../utils/errorMessage').ErrorMessage;
const {addMongooseParam, getHeaders, checkExistedDocument} = require('../../utils/helper');
var {isEmptyObject, validateRouter, _errorFormatter} = require('../../utils/helper');
const logger = require('../../utils/logger');
const consts = require('../../utils/consts');
const {handlerSuccess, handlerError} = require('../../utils/handler_response');
var ObjectID = require('mongodb').ObjectID;

module.exports = {
    classname: 'StatisticsController',

    async getLine(req, res, next) {
        try {
            validateRouter(req, res);

            var findParams = getFindParams(req.query);
            findParams = {
                ...findParams,
                ...{type: consts.STATISTICS_TYPE.LINE},
            };

            var line = await statisticsRepository.findLine(findParams);

            if (!line) {
                return handlerError(req, res, ErrorMessage.LINE_NOT_FOUND);
            }

            return handlerSuccess(req, res, line);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getChart(req, res, next) {
        try {
            validateRouter(req, res);

            var findParams = getFindParams(req.query);
            findParams = {
                ...findParams,
                ...{type: consts.STATISTICS_TYPE.CHART},
            };

            var statistics = await statisticsRepository.findChart(findParams);

            var listObjects = [];

            var sumaryObjects = {};

            if (statistics[0].nft_id) {
                for (let i = 0; i < statistics.length; i++) {
                    if (!listObjects.includes(statistics[i].nft_id)) {
                        listObjects.push(statistics[i].nft_id);
                    }
                    if (!sumaryObjects[statistics[i].nft_id._id]) {
                        sumaryObjects[statistics[i].nft_id._id] = 0;
                    }

                    sumaryObjects[statistics[i].nft_id._id] += statistics[i].value;
                }
            } else if (statistics[0].company_id) {
                for (let i = 0; i < statistics.length; i++) {
                    if (!listObjects.includes(statistics[i].company_id)) {
                        listObjects.push(statistics[i].company_id);
                    }
                    if (!sumaryObjects[statistics[i].company_id._id]) {
                        sumaryObjects[statistics[i].company_id._id] = 0;
                    }

                    sumaryObjects[statistics[i].company_id._id] += statistics[i].value;
                }
            } else {
                for (let i = 0; i < statistics.length; i++) {
                    if (!listObjects.includes(statistics[i].collection_id)) {
                        listObjects.push(statistics[i].collection_id);
                    }
                    if (!sumaryObjects[statistics[i].collection_id._id]) {
                        sumaryObjects[statistics[i].collection_id._id] = 0;
                    }

                    sumaryObjects[statistics[i].collection_id._id] += statistics[i].value;
                }
            }

            result = [];

            for (let i = 0; i < listObjects.length; i++) {
                result.push({
                    object: listObjects[i],
                    value: sumaryObjects[listObjects[i]._id],
                });
            }

            // Sort bring bigger value on top
            result.sort(function (a, b) {
                var valueA = a.value;
                var valueB = b.value;
                // Compare the 2 values
                if (valueA < valueB) return 1; // Smaller, position +1
                if (valueA > valueB) return -1; // Bigger, position -1
                return 0;
            });

            return handlerSuccess(req, res, result);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },

    async getSummaryPie(req, res, next) {
        try {
            validateRouter(req, res);

            let data = await getSummaryPieData();

            if (!data) {
                return handlerError(req, res, ErrorMessage.INTERNAL_SERVER_ERROR);
            }
            return handlerSuccess(req, res, data);
        } catch (error) {
            logger.error(new Error(error));
            next(error);
        }
    },
};

function getFindParams(filters) {
    let findParams = {};

    if (filters.type) {
        findParams.type = filters.type;
    }

    if (filters.name) {
        findParams.name = filters.name;
    }

    if (filters.from_date) {
        findParams.date = addMongooseParam(findParams.date, '$gte', filters.from_date);
    } else {
        let oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        findParams.date = addMongooseParam(findParams.date, '$gte', oneMonthAgo);
    }

    if (filters.to_date) {
        findParams.date = addMongooseParam(findParams.date, '$lte', filters.to_date);
    }

    return findParams;
}

async function getSummaryPieData() {
    let result = {};

    let adminIds = await adminRepository.getAdminIds();

    // Summary
    // number of nft
    let nfts = await nftRepository.count({
        type: consts.NFT_TYPE.NORMAL,
    });

    // number of airdrop
    let airdrops = await nftRepository.count({
        type: consts.NFT_TYPE.AIRDROP,
    });

    // number of successful transactions
    let transactions = await txRepository.count({
        seller: {$in: adminIds},
        status: consts.TRANSACTION_STATUS.SUCCESS,
    });

    // number of company
    // let companies = await companyRepository.count();
    let creators = await adminRepository.count({
        level: 'creator'
    });

    result.summary = {
        nfts: nfts,
        airdrops: airdrops,
        transactions: transactions,
        // companies: companies,
        creators: creators
    };

    // Pie chart
    let nftSold = await txRepository.count({
        seller: {$in: adminIds},
        price: {$gt: 0},
        status: consts.TRANSACTION_STATUS.SUCCESS,
    });

    let onSale = await serialRepository.count({
        owner_id: null,
        type: consts.NFT_TYPE.NORMAL,
        status: consts.SERIAL_STATUS.ACTIVE,
    });

    let suspend = await serialRepository.count({
        type: consts.NFT_TYPE.NORMAL,
        status: consts.SERIAL_STATUS.SUSPEND,
    });

    let inactive = await serialRepository.count({
        type: consts.NFT_TYPE.NORMAL,
        status: consts.SERIAL_STATUS.INACTIVE,
    });

    let total = nftSold + onSale + suspend + inactive;

    let header = [];
    header.push('Sold');
    header.push('On Sale');
    header.push('Inactive');
    header.push('Suspend');

    let data = [];
    data.push(Math.round((nftSold / total) * 100));
    data.push(Math.round((onSale / total) * 100));
    data.push(Math.round((inactive / total) * 100));
    data.push(Math.round((suspend / total) * 100));

    result.pie_chart = {
        header: header,
        data: data,
    };

    return result;
}
