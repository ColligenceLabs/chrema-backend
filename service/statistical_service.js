var consts = require('../utils/consts');
var statisticsRepository = require('../repositories/statistics_repository');
var txRepository = require('../repositories/transaction_repository');
var adminRepository = require('../repositories/admin_repository');
var serialRepository = require('../repositories/serial_repository');
var nftRepository = require('../repositories/nft_repository');

module.exports = {
    classname: 'StatisticalService',

    async statistics() {
        let now_time = new Date(); // Run at 15:15 UTC daily.
        let start_time = new Date(Date.UTC(now_time.getFullYear(), now_time.getMonth(), now_time.getDate() - 1, 15, 0, 0));
        let end_time = new Date(Date.UTC(now_time.getFullYear(), now_time.getMonth(), now_time.getDate(), 15, 0, 0));
        // start_time is the time at 00:00 UTC yesterday.
        // let start_time = new Date(Date.UTC(now_time.getFullYear(), now_time.getMonth(), now_time.getDate() - 1, 0, 0, 0));
        // end_time is the time at 00:00 UTC today.
        // let end_time = new Date(Date.UTC(now_time.getFullYear(), now_time.getMonth(), now_time.getDate(), 0, 0, 0));
        // let statistics_date = new Date(Date.UTC(now_time.getFullYear(), now_time.getMonth(), now_time.getDate() - 1, 0, 0, 0));

        let adminIds = await adminRepository.getAdminIds();

        let findParams = {
            seller: {$in: adminIds},
            date: {$gte: start_time, $lt: end_time},
            status: consts.TRANSACTION_STATUS.SUCCESS,
        };
        //get all transaction
        let txList = await txRepository.findAllTx(findParams);

        let line = {
            nft_revenue: 0,
            collection_revenue: 0,
            company_revenue: 0,
            total_revenue: 0,
        };

        let chart = {
            nft_revenue: [],
            nft_quantity: [],
            collection_revenue: [],
            collection_quantity: [],
            company_revenue: [],
            company_quantity: [],
            nftIds: [],
            collectionIds: [],
            companyIds: [],
        };

        for (let i = 0; i < txList.length; i++) {
            if (txList[i].serial_id.type == consts.NFT_TYPE.AIRDROP) {
                continue;
            }
            // console.log(txList[i].serial_id.nft_id)
            let nft = await nftRepository.findOneNft({_id: txList[i].serial_id.nft_id});
            let tx = await txRepository.findByTxId(txList[i]);

            if (nft.collection_id) {
                // line.collection_revenue += nft.price;
                line.collection_revenue += tx.price;
            } else {
                // line.nft_revenue += nft.price;
                line.nft_revenue += tx.price;
            }

            //calculate when type = chart
            chart = await calculate(nft, chart, 'nft', '_id');
            chart = await calculate(nft, chart, 'collection', 'collection_id');
            chart = await calculate(nft, chart, 'company', 'company_id');
        }

        line.total_revenue = line.collection_revenue + line.nft_revenue;

        //insert
        await statisticsRepository.create({
            type: consts.STATISTICS_TYPE.LINE,
            name: consts.STATISTICS.LINE.NFT_REVENUE,
            value: line.nft_revenue,
            date: start_time,
        });
        await statisticsRepository.create({
            type: consts.STATISTICS_TYPE.LINE,
            name: consts.STATISTICS.LINE.COLLECTION_REVENUE,
            value: line.collection_revenue,
            date: start_time,
        });
        await statisticsRepository.create({
            type: consts.STATISTICS_TYPE.LINE,
            name: consts.STATISTICS.LINE.TOTAL_REVENUE,
            value: line.total_revenue,
            date: start_time,
        });

        await insert(chart, 'nft', start_time);
        await insert(chart, 'collection', start_time);
        await insert(chart, 'company', start_time);
    },
};
// chart = await calculate(nft, chart, 'nft', '_id');
function calculate(nft, chart, chart_key, nft_key) {
    if (nft_key != '_id') {
        if (!nft[nft_key]) {
            return chart;
        }
    }

    if (!(chart[chart_key + 'Ids']).includes(nft[nft_key].toString())) {
        chart[chart_key + 'Ids'].push(nft[nft_key].toString());
        chart[chart_key + '_revenue'].push(nft.price);
        chart[chart_key + '_quantity'].push(1);
    } else {
        for (let j = 0; j < chart[chart_key + 'Ids'].length; j++) {
            if (chart[chart_key + 'Ids'][j] == nft[nft_key].toString()) {
                chart[chart_key + '_revenue'][j] += nft.price;
                chart[chart_key + '_quantity'][j] += 1;
                break;
            }
        }
    }
    return chart;
};

async function insert(chart, chart_key, date) {
    let ids = chart[chart_key + 'Ids'];
    let revenueList = chart[chart_key + '_revenue'];
    let quantityList = chart[chart_key + '_quantity'];
    for (let i = 0; i < ids.length; i++) {
        let valueData = {
            type: 'chart',
            name: chart_key + '_revenue',
            value: revenueList[i],
            date: date,
        };
        valueData[chart_key + '_id'] = ids[i];
        let quantityData = {
            type: 'chart',
            name: chart_key + '_quantity',
            value: quantityList[i],
            date: date,
        };
        quantityData[chart_key + '_id'] = ids[i];
        await statisticsRepository.create(valueData);
        await statisticsRepository.create(quantityData);
    }
};
