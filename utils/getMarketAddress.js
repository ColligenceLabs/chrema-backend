const constants = require('../config/constants');

exports.getMarketAddress = (network) => {
    let marketAddress;

    switch (network) {
        case 'klaytn':
            marketAddress = constants.market[parseInt(process.env.KLAYTN_CHAIN_ID ?? '0', 10)];
            break;
        case 'binance':
            marketAddress = constants.market[parseInt(process.env.BINANCE_CHAIN_ID ?? '0', 10)];
            break;
        case 'ethereum':
            marketAddress = constants.market[parseInt(process.env.ETH_CHAIN_ID ?? '0', 10)];
        default:
            break;
    }

    return marketAddress;
}