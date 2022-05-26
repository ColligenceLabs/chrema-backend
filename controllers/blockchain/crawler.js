const collectionRepository = require('../../repositories/collection_repository');
const lastblockRepository = require('../../repositories/lastblock_repository');
const tradeRepository = require('../../repositories/trade_repository');
const {NftModel, SerialModel, TransactionModel, ListenerModel, TradeModel} = require('../../models');
const BigNumber = require('bignumber.js');
const consts = require('../../utils/consts');

const {getCoinPrice, getWeb3ByChainName, getChainId, getMarketAddress, getMarketContract} = require('../../utils/helper');

// convert hex result to address
function hexToAddress(hexVal) {
    return '0x' + hexVal.substr(-40);
}

// get events
exports.getLastEvents = async function (toBlock, chainName) {
    const contracts = await collectionRepository.getContracts(chainName);
    if (contracts.length === 0)
        return;
    let lastBlock = await lastblockRepository.find(getChainId(chainName), 'event');
    const web3 = getWeb3ByChainName(chainName);
    if (!web3) return;
    console.log('getLastEvents', lastBlock, toBlock, chainName);
    await web3.eth.getPastLogs(
        // {fromBlock: lastBlock, toBlock: toBlock, address: contractAddress},
        {fromBlock: lastBlock, toBlock: toBlock, address: contracts},
        async (err, result) => {
            if (!err) {
                if (result.length > 0) {
                    lastBlock = result[result.length - 1].blockNumber + 1;
                    console.log('update last block ----->', result);
                    for (let i = 0; i < result.length; i++) {
                        let contract = result[i].address;
                        let collection = await collectionRepository.findByContractAddress(contract);
                        if (!collection) {
                            continue;
                        }
                        let contractAddress = contract.toLowerCase();
                        if (result[i].topics) {
                            if (result[i].topics[0] == '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef') {// transfer
                                let fromAddress = hexToAddress(result[i].topics[1]);
                                let toAddress = hexToAddress(result[i].topics[2]);
                                let tokenIdDeciaml = web3.utils.hexToNumber(result[i].topics[3]);
                                let tokenIdHex = '0x' + tokenIdDeciaml.toString(16);
                                let transactionHash = result[i].transactionHash;
                                console.log(`tokenIdDeciaml: ${tokenIdDeciaml} hash: ${transactionHash}`);

                                if (fromAddress == '0x0000000000000000000000000000000000000000') {// mint
                                    let nftIds = await SerialModel.aggregate([
                                        {$match: {contract_address: contractAddress, token_id: tokenIdHex}},
                                        {$group: {_id: '$nft_id'}}
                                    ]);
                                    if (nftIds.length > 1) {
                                        const nfts = await NftModel.find({_id: {$in: nftIds}});
                                        for (let i = 0; i < nfts.length; i++) {
                                            if (nfts[i].onchain === 'false') {
                                                // serials 삭제
                                                console.log('duplicate token id onchain false nft id : ', nfts[i]._id);
                                                try {
                                                    const ret1 = await SerialModel.deleteMany({nft_id: nfts[i]._id});
                                                    const ret2 = await NftModel.deleteOne({_id: nfts[i]._id});
                                                    console.log('removed', ret1, ret2);
                                                } catch (e) {
                                                    console.log(e);
                                                }
                                            }
                                        }
                                    }
                                    let serial = await SerialModel.findOneAndUpdate(
                                        {
                                            contract_address: contractAddress,
                                            token_id: tokenIdHex,
                                            owner: null,
                                            status: consts.SERIAL_STATUS.INACTIVE,
                                        },
                                        {$set: {status: consts.SERIAL_STATUS.ACTIVE}},
                                        {returnDocument: 'after'},
                                    ).sort({createdAt: -1});
                                    if (!serial) continue;
                                    await ListenerModel.create({
                                        token_id: tokenIdDeciaml,
                                        tx_id: transactionHash,
                                        from: fromAddress,
                                        to: toAddress,
                                        nft_id: serial.nft_id._id,
                                        chain_id: process.env.KLAYTN_CHAIN_ID,
                                        contract_address: contractAddress,
                                        type: consts.LISTENER_TYPE.MINT,
                                    });
                                    if (serial) await NftModel.findOneAndUpdate({_id: serial.nft_id._id}, {
                                        status: consts.NFT_STATUS.ACTIVE,
                                    });
                                } else if (toAddress == '0x0000000000000000000000000000000000000000') {// burn
                                    let serial = await SerialModel.findOneAndUpdate(
                                        {contract_address: contractAddress, token_id: tokenIdHex},
                                        {$set: {status: consts.SERIAL_STATUS.SUSPEND}},
                                        {returnDocument: 'after'},
                                    );
                                    if (!serial) continue;
                                    await ListenerModel.create({
                                        token_id: tokenIdDeciaml,
                                        tx_id: transactionHash,
                                        nft_id: serial.nft_id._id,
                                        from: fromAddress,
                                        to: toAddress,
                                        chain_id: process.env.KLAYTN_CHAIN_ID,
                                        contract_address: contractAddress,
                                        type: consts.LISTENER_TYPE.BURN,
                                    });
                                    if (serial) await NftModel.findOneAndUpdate({_id: serial.nft_id._id}, {
                                        $inc: {quantity_selling: -1},
                                        status: consts.NFT_STATUS.SUSPEND,
                                    });
                                } else {// other transfer(buy, airdrop)
                                    let transaction = await TransactionModel.findOneAndUpdate(
                                        {tx_id: transactionHash},
                                        {$set: {status: consts.TRANSACTION_STATUS.SUCCESS}},
                                        {returnDocument: 'after'},
                                    );
                                    if (transaction) await SerialModel.findOneAndUpdate({_id: transaction.serial_id._id}, {transfered: consts.TRANSFERED.TRANSFERED});
                                }
                            }
                                // keccak hash : TransferSingle(address,address,address,uint256,uint256)
                            // https://baobab.scope.klaytn.com/tx/0xa376776f1fd040e1e78499c9d15db374b64ccb27d994c2bcd31f7c4a4d9a06a5?tabId=eventLog
                            else if (
                                result[i].topics[0] ==
                                '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'
                            ) {
                                let contractAddress = result[i].address.toLowerCase();
                                const data = web3.eth.abi.decodeParameters(['uint256', 'uint256'], result[i].data);
                                let fromAddress = hexToAddress(result[i].topics[1]);
                                let toAddress = hexToAddress(result[i].topics[2]);
                                console.log('====!!!!', result[i].topics, data);
                                let tokenIdDeciaml = parseInt(data[0]);
                                let tokenIdHex = '0x' + tokenIdDeciaml.toString(16);

                                let transactionHash = result[i].transactionHash;
                                // transfer
                                if (
                                    result[i].topics[2] ==
                                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                                ) {
                                    let nftIds = await SerialModel.aggregate([
                                        {$match: {contract_address: contractAddress, token_id: tokenIdHex}},
                                        {$group: {_id: '$nft_id'}}
                                    ]);
                                    if (nftIds.length > 1) {
                                        const nfts = await NftModel.find({_id: {$in: nftIds}});
                                        for (let i = 0; i < nfts.length; i++) {
                                            if (nfts[i].onchain === 'false') {
                                                // serials 삭제
                                                console.log('duplicate token id onchain false nft id : ', nfts[i]._id);
                                                try {
                                                    const ret1 = await SerialModel.deleteMany({nft_id: nfts[i]._id});
                                                    const ret2 = await NftModel.deleteOne({_id: nfts[i]._id});
                                                    console.log('removed. ', ret1, ret2);
                                                } catch (e) {
                                                    console.log(e);
                                                }
                                            }
                                        }
                                    }
                                    // mint
                                    let result = await SerialModel.updateMany(
                                        {
                                            contract_address: contractAddress,
                                            token_id: tokenIdHex,
                                            owner: null,
                                            status: consts.SERIAL_STATUS.INACTIVE,
                                        },
                                        {$set: {status: consts.SERIAL_STATUS.ACTIVE}},
                                    );
                                    const serial = await SerialModel.findOne({
                                        contract_address: contractAddress,
                                        token_id: tokenIdHex,
                                    }).sort({createdAt: -1});
                                    if (!serial) continue;
                                    await ListenerModel.create({
                                        token_id: tokenIdDeciaml,
                                        tx_id: transactionHash,
                                        nft_id: serial.nft_id._id,
                                        from: fromAddress,
                                        to: toAddress,
                                        chain_id: process.env.KLAYTN_CHAIN_ID,
                                        contract_address: contractAddress,
                                        type: consts.LISTENER_TYPE.MINT,
                                    });
                                    if (serial) await NftModel.findOneAndUpdate({_id: serial.nft_id._id}, {status: consts.NFT_STATUS.ACTIVE});
                                } else if (
                                    result[i].topics[3] ==
                                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                                ) {
                                    // burn
                                    let amount = data[1];
                                    let result = await SerialModel.updateMany(
                                        {contract_address: contractAddress, token_id: tokenIdHex},
                                        {$set: {status: consts.SERIAL_STATUS.SUSPEND}},
                                        {returnDocument: 'after'},
                                    );
                                    const serial = await SerialModel.findOne({
                                        contract_address: contractAddress,
                                        token_id: tokenIdHex,
                                    });
                                    if (!serial) continue;
                                    await ListenerModel.create({
                                        token_id: tokenIdDeciaml,
                                        tx_id: transactionHash,
                                        nft_id: serial.nft_id._id,
                                        from: fromAddress,
                                        to: toAddress,
                                        chain_id: process.env.KLAYTN_CHAIN_ID,
                                        contract_address: contractAddress,
                                        type: consts.LISTENER_TYPE.BURN,
                                    });
                                    if (serial) await NftModel.findOneAndUpdate({_id: serial.nft_id._id}, {
                                        quantity_selling: 0,
                                        status: consts.NFT_STATUS.SUSPEND,
                                    });
                                } else {
                                    // buy or airdrop nft
                                    // TODO 여러개가 한번에 팔리는 경우에 대한 처리 필요(여러개의 serial 을 suspend 처리해야함?)
                                    let transaction = await TransactionModel.findOneAndUpdate(
                                        {tx_id: transactionHash},
                                        {$set: {status: consts.TRANSACTION_STATUS.SUCCESS}},
                                        {returnDocument: 'after'},
                                    );
                                    if (transaction) await SerialModel.findOneAndUpdate({_id: transaction.serial_id._id}, {transfered: consts.TRANSFERED.TRANSFERED});
                                }
                            } else if (result[i].topics[0] == '0x000000') {
                                // approve chưa biết mã topic nên chưa xong
                            }
                        }
                    }
                }
                lastBlock = toBlock + 1;
                await lastblockRepository.update(getChainId(chainName), 'event', lastBlock);
                return true;
            }
            console.log(err);
        },
    ).catch((e) => {
        console.log('collection contract getEvents', e);
    });
    console.log('getlastevent end');
}

exports.getMarketEvents = async function (toBlock, chainName) {
    try {
        let lastMarketBlock = await lastblockRepository.find(getChainId(chainName), 'market');
        const web3 = getWeb3ByChainName(chainName);
        if (!web3) return;
        const marketContract = getMarketContract(chainName);
        console.log('getMarketEvents', lastMarketBlock, toBlock, chainName);
        if (marketContract !== null) {
            await marketContract.getPastEvents('allEvents', {fromBlock: lastMarketBlock, toBlock: toBlock})
                .then(async function(events) {
                    let coinPrice;
                    if (events.length > 0) {
                        coinPrice = await getCoinPrice();
                    }
                    for (let i = 0; events.length > i; i++) {
                        const tokenIdHex = '0x' + parseInt(events[i].returnValues.tokenId, 10).toString(16);
                        if (events[i].event === 'Trade') {
                            console.log(events[i].transactionHash, 'Trade event handle start.');
                            // const tokenIdHex = '0x' + parseInt(events[i].returnValues.tokenId, 10).toString(16);
                            console.log(events[i].returnValues);
                            let serials = await SerialModel.find({
                                contract_address: events[i].returnValues.nft.toLowerCase(),
                                token_id: tokenIdHex,
                                buyer: events[i].returnValues.buyer,
                                status: consts.SERIAL_STATUS.BUYING,
                            });
                            const serialIds = serials.map((doc) => doc._id);
                            const result = await SerialModel.updateMany(
                                {_id: {$in: serialIds}},
                                {
                                    $set: {
                                        status: consts.SERIAL_STATUS.ACTIVE,
                                        owner_id: events[i].returnValues.buyer,
                                        seller: null,
                                        buyer: null,
                                    },
                                },
                            );
                            if (serialIds.length === 0) continue;
                            const block = await web3.eth.getBlock(events[i].blockNumber).catch(e => console.log('getBlock fail', e));
                            console.log(block.timestamp, serials[0].nft_id._id);
                            const nft = await NftModel.findOne({_id: serials[0].nft_id._id});
                            console.log(web3.utils.fromWei(events[i].returnValues.price, 'ether'), web3.utils.fromWei(events[i].returnValues.fee, 'ether'));
                            const trade = await TradeModel.create({
                                tx_hash: events[i].transactionHash,
                                block_number: events[i].blockNumber,
                                chain_id: process.env.KLAYTN_CHAIN_ID,
                                seller: events[i].returnValues.seller,
                                buyer: events[i].returnValues.buyer,
                                contract_address: events[i].returnValues.nft,
                                token_id: tokenIdHex,
                                price: web3.utils.fromWei(events[i].returnValues.price, 'ether'),
                                fee: web3.utils.fromWei(events[i].returnValues.fee, 'ether'),
                                quote: nft.quote,
                                collection_id: nft.collection_id,
                                trade_date: new Date(block.timestamp * 1000),
                            });
                            // update hour trade statistics
                            let hourIndex = Math.floor(block.timestamp / 3600);
                            let hourStartUnix = hourIndex * 3600;
                            await tradeRepository.updateHourData(trade.collection_id, hourStartUnix, trade.price, trade.quote, coinPrice);
                            // update day trade statistics
                            let dayID = Math.floor(block.timestamp / 86400);
                            let dayStartUnix = dayID * 86400;
                            await tradeRepository.updateDayData(trade.collection_id, dayStartUnix, trade.price, trade.quote, coinPrice);

                            const history = {
                                token_id: events[i].returnValues.tokenId,
                                tx_id: events[i].transactionHash,
                                contract_address: events[i].returnValues.nft.toLowerCase(),
                                nft_id: nft._id,
                                from: events[i].returnValues.seller,
                                to: events[i].returnValues.buyer,
                                chain_id: process.env.KLAYTN_CHAIN_ID,
                                quantity: events[i].returnValues.amount,
                                price: trade.price,
                                quote: trade.quote,
                                block_number: events[i].blockNumber,
                                block_date: new Date(block.timestamp * 1000),
                                type: consts.LISTENER_TYPE.BUY,
                            };
                            await ListenerModel.create(history);
                            // nft last price 저장
                            const lastPrice = (new BigNumber(trade.price)).div(events[i].returnValues.amount).toNumber();
                            const salePriceUSD = (new BigNumber(trade.price)).div(events[i].returnValues.amount).multipliedBy(coinPrice[trade.quote].USD).toNumber();
                            await NftModel.updateOne({_id: nft._id}, {
                                $set: {
                                    sort_sale_price: salePriceUSD,
                                    last_price: lastPrice,
                                    last_quote: trade.quote
                                }
                            });
                            console.log(events[i].transactionHash, 'Trade create success.');
                        } else if (events[i].event === 'CancelSellToken') {
                            // console.log(events[i]);
                            console.log('=====>Cancel', events[i]);
                            // const tokenIdHex = '0x' + parseInt(events[i].returnValues.tokenId, 10).toString(16);
                            let serials = await SerialModel.find({
                                contract_address: events[i].returnValues.nft.toLowerCase(),
                                token_id: tokenIdHex,
                            });
                            if (serials.length === 0) continue;
                            const block = await web3.eth.getBlock(events[i].blockNumber).catch(e => console.log('getBlock fail', e));
                            const history = {
                                token_id: events[i].returnValues.tokenId,
                                tx_id: events[i].transactionHash,
                                contract_address: events[i].returnValues.nft.toLowerCase(),
                                nft_id: serials[0].nft_id._id,
                                from: getMarketAddress(chainName),
                                to: events[i].returnValues.seller,
                                chain_id: process.env.KLAYTN_CHAIN_ID,
                                quantity: events[i].returnValues.quantity,
                                price: web3.utils.fromWei(events[i].returnValues.price, 'ether'),
                                quote: events[i].returnValues.quote === '0x0000000000000000000000000000000000000000' ? 'klay' : 'talk',
                                block_number: events[i].blockNumber,
                                block_date: new Date(block.timestamp * 1000),
                                type: consts.LISTENER_TYPE.CANCEL,
                            };
                            await ListenerModel.create(history);
                        } else if (events[i].event === 'Ask') {
                            // what mean Ask event??
                            console.log('=====>Ask', events[i]);
                            // console.log(events[i]);
                            // const tokenIdHex = '0x' + parseInt(events[i].returnValues.tokenId, 10).toString(16);
                            let serials = await SerialModel.find({
                                contract_address: events[i].returnValues.nft.toLowerCase(),
                                token_id: tokenIdHex,
                            });
                            if (serials.length === 0) continue;
                            const block = await web3.eth.getBlock(events[i].blockNumber).catch(e => console.log('getBlock fail', e));

                            const history = {
                                token_id: events[i].returnValues.tokenId,
                                tx_id: events[i].transactionHash,
                                contract_address: events[i].returnValues.nft.toLowerCase(),
                                nft_id: serials[0].nft_id._id,
                                from: events[i].returnValues.seller,
                                to: getMarketAddress(chainName),
                                chain_id: process.env.KLAYTN_CHAIN_ID,
                                quantity: events[i].returnValues.quantity,
                                price: web3.utils.fromWei(events[i].returnValues.price, 'ether'),
                                quote: events[i].returnValues.quote === '0x0000000000000000000000000000000000000000' ? 'klay' : 'talk',
                                block_number: events[i].blockNumber,
                                block_date: new Date(block.timestamp * 1000),
                                type: consts.LISTENER_TYPE.SELL,
                            };
                            await ListenerModel.create(history);
                        }
                    }
                    lastMarketBlock = toBlock + 1;
                    await lastblockRepository.update(getChainId(chainName), 'market', lastMarketBlock);
                }).catch((e) => {
                    console.log('market contract getEvents', e);
                });
        }
    } catch (e) {
        console.log('market getEvents error', e);
    }
}