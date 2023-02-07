const consts = require('../../utils/consts');
const {getWeb3ByChainName} = require('../../utils/helper');
const lastblockRepository = require('../../repositories/lastblock_repository');
const {getLastEvents, getMarketEvents} = require('./crawler');

const useCrawler = process.env.USE_CRAWLER;

// load last checked block from file
async function loadConfFromDB() {
    // 설정된 chain id 별로 lastblock 조회 없을 경우 create
    // event crawler
    // ethereum
    const eventBlocks = {};
    const marketEventBlocks = {};
    if (process.env.ETH_CHAIN_ID) {
        let ethEventLastBlock = await lastblockRepository.find(process.env.ETH_CHAIN_ID, 'event');
        if (!ethEventLastBlock) {
            if (process.env.ETH_CHAIN_ID === '1')
                ethEventLastBlock = 16573987;
            else if (process.env.ETH_CHAIN_ID === '5')
                ethEventLastBlock = 8447943;
            await lastblockRepository.create(process.env.ETH_CHAIN_ID, 'event', ethEventLastBlock);
        }
        let ethMarketLastBlock = await lastblockRepository.find(process.env.ETH_CHAIN_ID, 'market');
        if (!ethMarketLastBlock) {
            if (process.env.ETH_CHAIN_ID === '1')
                ethMarketLastBlock = 16573987;
            else if (process.env.ETH_CHAIN_ID === '5')
                ethMarketLastBlock = 8447943;
            await lastblockRepository.create(process.env.ETH_CHAIN_ID, 'market', ethMarketLastBlock);
        }
        eventBlocks.eth = ethEventLastBlock;
        marketEventBlocks.eth = ethMarketLastBlock;
    }

    if (process.env.KLAYTN_CHAIN_ID) {
        // klaytn
        let klaytnEventLastBlock = await lastblockRepository.find(process.env.KLAYTN_CHAIN_ID, 'event');
        if (!klaytnEventLastBlock) {
            if (process.env.KLAYTN_CHAIN_ID === '8217')
                klaytnEventLastBlock = 113830501;
            else if (process.env.KLAYTN_CHAIN_ID === '1001')
                klaytnEventLastBlock = 114160868;
            await lastblockRepository.create(process.env.KLAYTN_CHAIN_ID, 'event', klaytnEventLastBlock);
        }
        let klaytnMarketLastBlock = await lastblockRepository.find(process.env.KLAYTN_CHAIN_ID, 'market');
        if (!klaytnMarketLastBlock) {
            if (process.env.KLAYTN_CHAIN_ID === '8217')
                klaytnMarketLastBlock = 113830501;
            else if (process.env.KLAYTN_CHAIN_ID === '1001')
                klaytnMarketLastBlock = 114160868;
            await lastblockRepository.create(process.env.KLAYTN_CHAIN_ID, 'market', klaytnMarketLastBlock);
        }
        eventBlocks.klaytn = klaytnEventLastBlock;
        marketEventBlocks.klaytn = klaytnMarketLastBlock;
    }

    if (process.env.BINANCE_CHAIN_ID) {
        // binance
        let binanceEventLastBlock = await lastblockRepository.find(process.env.BINANCE_CHAIN_ID, 'event');
        if (!binanceEventLastBlock) {
            if (process.env.BINANCE_CHAIN_ID === '56')
                binanceEventLastBlock = 18105956;
            else if (process.env.BINANCE_CHAIN_ID === '97')
                binanceEventLastBlock = 19610641;
            await lastblockRepository.create(process.env.BINANCE_CHAIN_ID, 'event', binanceEventLastBlock);
        }
        let binanceMarketLastBlock = await lastblockRepository.find(process.env.BINANCE_CHAIN_ID, 'market');
        if (!binanceMarketLastBlock) {
            if (process.env.BINANCE_CHAIN_ID === '56')
                binanceMarketLastBlock = 25448874;
            else if (process.env.BINANCE_CHAIN_ID === '97')
                binanceMarketLastBlock = 27018824;
            await lastblockRepository.create(process.env.BINANCE_CHAIN_ID, 'market', binanceMarketLastBlock);
        }
        eventBlocks.binance = binanceEventLastBlock;
        marketEventBlocks.binance = binanceMarketLastBlock;
    }
    const lastBlocks = {
        event: eventBlocks,
        market: marketEventBlocks
    }
    return lastBlocks;
}

async function getChainEvents(chainName, lastBlocks) {
    if (lastBlocks.event[chainName] && lastBlocks.market[chainName]) {
        const useMarket = process.env.USE_MARKET === 'true' ? true : false;
        const web3 = getWeb3ByChainName(chainName);
        if (!web3) return;
        try {
            let toBlock = await web3.eth.getBlockNumber();

            if (useMarket && lastBlocks.market[chainName]) {
                const lastBlockNumber = lastBlocks.market[chainName];
                // console.log('market', lastBlockNumber, toBlock, toBlock - lastBlockNumber);
                if (chainName === 'binance' || chainName === 'eth') {
                    if (toBlock <= lastBlockNumber) return;
                }
                if (toBlock - lastBlocks.market[chainName] > 1000) {
                    for (let to = lastBlockNumber + 1000; to <= toBlock; to += 1000) {
                        await getMarketEvents(to, chainName);
                        // console.log(lastBlocks.event[chainName], to);
                        lastBlocks.market[chainName] = to + 1;
                    }
                }
                await getMarketEvents(toBlock, chainName);
                // console.log(lastBlocks.event[chainName], toBlock);
                lastBlocks.market[chainName] = toBlock + 1;
            }

            if (lastBlocks.event[chainName]) {
                const lastBlockNumber = lastBlocks.event[chainName];
                if (process.env.USE_KAS !== 'true') {
                    let delay = process.env.CRAWLER_DELAY;
                    if (chainName === 'binance')
                        delay = 7;
                    else if (chainName === 'eth')
                        delay = 4;
                    toBlock = toBlock - delay;
                }

                if (chainName === 'binance' || chainName === 'eth') {
                    if (toBlock <= lastBlockNumber) return;
                }
                // console.log('event', lastBlockNumber, toBlock, toBlock - lastBlockNumber);
                if (toBlock - lastBlockNumber > 1000) {
                    for (let to = lastBlockNumber + 1000; to <= toBlock; to += 1000) {
                        await getLastEvents(to, chainName);
                        // console.log(lastBlocks.event[chainName], to);
                        lastBlocks.event[chainName] = to + 1;
                    }
                }
                await getLastEvents(toBlock, chainName);
                // console.log(lastBlocks.event[chainName], toBlock);
                lastBlocks.event[chainName] = toBlock + 1;
            }
        } catch (e) {
            console.log(e);
        }
    }
}

async function main() {
    if (useCrawler === 'true') {
        // init
        const lastBlocks = await loadConfFromDB();
        // console.log('lastBlocks', lastBlocks);
        for (let i = 0; i < consts.CHAIN_NAMES.length; i++) {
            console.log(consts.CHAIN_NAMES[i]);
            await getChainEvents(consts.CHAIN_NAMES[i], lastBlocks);
        }

        // set timer to get events every 2 seconds
        setInterval(async function() {
            for (let i = 0; i < consts.CHAIN_NAMES.length; i++) {
                // console.log(consts.CHAIN_NAMES[i]);
                await getChainEvents(consts.CHAIN_NAMES[i], lastBlocks);
            }
        }, 2000);
    }
}

main();