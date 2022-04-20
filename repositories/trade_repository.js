const {HourTradeModel, DayTradeModel} = require('../models');
const {addMongooseParam} = require('../utils/helper');
const BigNumber = require('bignumber.js');
const Web3 = require('web3');
const web3 = new Web3(process.env.PROVIDER_URL);

module.exports = {
    updateDayData: async function(collection_id, day_start_unix, price, quote, marketPrice) {
        try {
            const dayData = await DayTradeModel.findOne({collection_id, day_start_unix});
            if (!dayData) {
                // create
                const total_volume_usd = (new BigNumber(price)).multipliedBy(marketPrice[quote].USD).toNumber();
                const total_volume_won = (new BigNumber(price)).multipliedBy(marketPrice[quote].KRW).toNumber();
                await DayTradeModel.create({
                    collection_id,
                    day_start_unix,
                    total_volume: price,
                    total_volume_usd,
                    total_volume_won
                });
            } else {
                // update
                const total_volume = dayData.total_volume + price;
                const total_volume_usd = (new BigNumber(dayData.total_volume_usd)).plus((new BigNumber(price)).multipliedBy(marketPrice[quote].USD)).toNumber();
                const total_volume_won = (new BigNumber(dayData.total_volume_won)).plus((new BigNumber(price)).multipliedBy(marketPrice[quote].KRW)).toNumber();
                const result = await DayTradeModel.updateOne({collection_id, day_start_unix},
                    {
                        $set: {
                            total_volume,
                            total_volume_usd,
                            total_volume_won
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
                const total_volume_won = (new BigNumber(price)).multipliedBy(new BigNumber(marketPrice[quote].KRW)).toNumber();
                await HourTradeModel.create({
                    collection_id,
                    hour_start_unix,
                    total_volume: price,
                    total_volume_usd,
                    total_volume_won
                });
            } else {
                // update
                const total_volume = hourData.total_volume + price;
                const total_volume_usd = (new BigNumber(hourData.total_volume_usd)).plus((new BigNumber(price)).multipliedBy(new BigNumber(marketPrice[quote].USD))).toNumber();
                const total_volume_won = (new BigNumber(hourData.total_volume_won)).plus((new BigNumber(price)).multipliedBy(new BigNumber(marketPrice[quote].KRW))).toNumber();
                const result = await HourTradeModel.updateOne({collection_id, hour_start_unix},
                    {$set: {
                        total_volume,
                        total_volume_usd,
                        total_volume_won
                    }});
                console.log(result);
            }
        } catch (e) {
            console.log('updateHourData error', e);
        }
    },

};
