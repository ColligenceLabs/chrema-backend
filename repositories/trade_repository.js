const {HourTradeModel, DayTradeModel} = require('../models');
const BigNumber = require('bignumber.js');
const moment = require('moment');

module.exports = {
    updateDayData: async function(collection_id, day_start_unix, price, quote, marketPrice) {
        try {
            const dayData = await DayTradeModel.findOne({collection_id, day_start_unix});
            if (!dayData) {
                // create
                const total_volume_usd = (new BigNumber(price)).multipliedBy(marketPrice[quote].USD).toNumber();
                const total_volume_krw = (new BigNumber(price)).multipliedBy(marketPrice[quote].KRW).toNumber();
                await DayTradeModel.create({
                    collection_id,
                    day_start_unix,
                    total_volume: price,
                    total_volume_usd,
                    total_volume_krw
                });
            } else {
                // update
                const total_volume = dayData.total_volume + price;
                const total_volume_usd = (new BigNumber(dayData.total_volume_usd)).plus((new BigNumber(price)).multipliedBy(marketPrice[quote].USD)).toNumber();
                const total_volume_krw = (new BigNumber(dayData.total_volume_krw)).plus((new BigNumber(price)).multipliedBy(marketPrice[quote].KRW)).toNumber();
                const result = await DayTradeModel.updateOne({collection_id, day_start_unix},
                    {
                        $set: {
                            total_volume,
                            total_volume_usd,
                            total_volume_krw
                        }
                    });
                console.log(result);
            }
        } catch (e) {
            console.log('updateDayData error', e);
        }
    },
    updateHourData: async function(collection_id, hour_start_unix, price, quote, marketPrice) {
        try {
            const hourData = await HourTradeModel.findOne({collection_id, hour_start_unix});
            if (!hourData) {
                // create
                const total_volume_usd = (new BigNumber(price)).multipliedBy(new BigNumber(marketPrice[quote].USD)).toNumber();
                const total_volume_krw = (new BigNumber(price)).multipliedBy(new BigNumber(marketPrice[quote].KRW)).toNumber();
                await HourTradeModel.create({
                    collection_id,
                    hour_start_unix,
                    total_volume: price,
                    total_volume_usd,
                    total_volume_krw
                });
            } else {
                // update
                const total_volume = hourData.total_volume + price;
                const total_volume_usd = (new BigNumber(hourData.total_volume_usd)).plus((new BigNumber(price)).multipliedBy(new BigNumber(marketPrice[quote].USD))).toNumber();
                const total_volume_krw = (new BigNumber(hourData.total_volume_krw)).plus((new BigNumber(price)).multipliedBy(new BigNumber(marketPrice[quote].KRW))).toNumber();
                const result = await HourTradeModel.updateOne({collection_id, hour_start_unix},
                    {$set: {
                        total_volume,
                        total_volume_usd,
                        total_volume_krw
                    }});
                console.log(result);
            }
        } catch (e) {
            console.log('updateHourData error', e);
        }
    },

    selectTopCollections: async function(days, limit, skip) {
        let result;
        if (days === '1d') {
            const yesterday = moment().subtract('1', 'd').unix();
            result = await HourTradeModel.aggregate([
                {$match: {hour_start_unix: {$gt: yesterday}}},
                {$group: {_id: '$collection_id', total_volume: {$sum: '$total_volume'}, total_volume_usd: {$sum: '$total_volume_usd'}, total_volume_krw: {$sum: '$total_volume_krw'}}},
                {$sort: {total_volume: -1}}
            ]).skip(skip).limit(limit);
        } else if (days === '7d') {
            const oneWeekAgo = moment().subtract('7', 'd').unix();
            result = await DayTradeModel.aggregate([
                {$match: {day_start_unix: {$gt: oneWeekAgo}}},
                {$group: {_id: '$collection_id', total_volume: {$sum: '$total_volume'}, total_volume_usd: {$sum: '$total_volume_usd'}, total_volume_krw: {$sum: '$total_volume_krw'}}},
                {$sort: {total_volume: -1}}
            ]).skip(skip).limit(limit);
        } else if (days === '30d') {
            const oneMonthAgo = moment().subtract('30', 'd').unix();
            result = await DayTradeModel.aggregate([
                {$match: {day_start_unix: {$gt: oneMonthAgo}}},
                {$group: {_id: '$collection_id', total_volume: {$sum: '$total_volume'}, total_volume_usd: {$sum: '$total_volume_usd'}, total_volume_krw: {$sum: '$total_volume_krw'}}},
                {$sort: {total_volume: -1}}
            ]).skip(skip).limit(limit);
        }
        return result;
    }
};
