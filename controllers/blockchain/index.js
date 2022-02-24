const Web3 = require('web3');
const web3 = new Web3(process.env.PROVIDER_URL);
const contractAddress = process.env.NFT_CONTRACT_ADDR;
const fs = require('fs');
var ObjectID = require('mongodb').ObjectID;
var nftRepository = require('../../repositories/nft_repository');
var serialRepository = require('../../repositories/serial_repository');
var txRepository = require('../../repositories/transaction_repository');
var listenerRepository = require('../../repositories/listener_repository');
var contractRepository = require('../../repositories/contract_repository');
var consts = require('../../utils/consts');
var {calcQuantitySellingNumber} = require('../../utils/helper');
const collectionRepository = require('../../repositories/collection_repository');
const {handlerError} = require('../../utils/handler_response');
const {ErrorMessage} = require('../../utils/errorMessage');
var lastBlock = 0;

// load last checked block from file
function loadConf() {
    if (fs.existsSync('lastcheckedblock.conf')) {
        let rawdata = fs.readFileSync('lastcheckedblock.conf');
        lastBlock = parseInt(rawdata);
    } else {
        lastBlock = 68397139;
    }
}

// save last event's block to file - incase reload service
function saveConf() {
    fs.writeFileSync('lastcheckedblock.conf', lastBlock + '');
}

// convert hex result to address
function toAddress(hexVal) {
    return '0x' + hexVal.substr(-40);
}

// get events
async function getLastEvents() {
    const delay = process.env.CRAWLER_DELAY;
    var toBlock = (await web3.eth.getBlockNumber()) * 1 - delay;
    // console.log(toBlock);
    if (toBlock - lastBlock > 4000) {
        toBlock = lastBlock * 1 + 4000 - delay;
    }

    // console.log(lastBlock, toBlock);

    const contracts = await collectionRepository.getContracts();
    contracts.push(process.env.NFT_CONTRACT_ADDR)
    // console.log(contracts)

    web3.eth.getPastLogs(
        // {fromBlock: lastBlock, toBlock: toBlock, address: contractAddress},
        {fromBlock: lastBlock, toBlock: toBlock, address: contracts},
        async (err, result) => {
            if (!err) {
                if (result.length > 0) {
                    lastBlock = result[result.length - 1].blockNumber + 1;
                    console.log('update last block');

                    // routing
                    for (let i = 0; i < result.length; i++) {
                        if (result[i].topics) {
                            let contract = result[i].address;
                            let collection = await collectionRepository.findByContractAddress(contract);
                            if (!collection) {
                                continue;
                            }
                            let collectionId = new ObjectID(collection._id);

                            // keccak hash : Transfer(address,address,uint256)
                            if (
                                result[i].topics[0] ==
                                '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
                            ) {
                                // transfer
                                if (
                                    result[i].topics[1] ==
                                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                                ) {
                                    // mint
                                    let userAddress = toAddress(result[i].topics[2]);
                                    let tokenId = web3.utils.hexToNumber(result[i].topics[3]);
                                    tokenId = '0x' + tokenId.toString(16);
                                    console.log('mint, new owner:', userAddress);
                                    console.log('tokenid:', tokenId);
                                    console.log('transactionHash', result[i].transactionHash);

                                    // save tokenID
                                    // TODO: 2021.12.28 추후 수정할 수 도있음. 지금은 DB에 직접 contract를 추가하도록 한다.
                                    // let contract = await contractRepository.findByContractAddress(contractAddress);
                                    // let contractId = new ObjectID(contract._id);
                                    let listener_save = {
                                        token_id: parseInt(tokenId.replace('0x', ''), 16),
                                        tx_id: result[i].transactionHash,
                                        type: consts.LISTENER_TYPE.MINT,
                                        // contract_id: contractId,
                                        contract_address: contract.toLowerCase(),
                                        collection_id: collectionId
                                    };

                                    await listenerRepository.create(listener_save);

                                    // active nft
                                    let serial = await serialRepository.findOneSerial({
                                        token_id: tokenId,
                                        owner: null,
                                        status: consts.SERIAL_STATUS.INACTIVE,
                                    });
                                    if (serial) {
                                        // active serial
                                        await serialRepository.update(
                                            {_id: serial._id},
                                            {status: consts.SERIAL_STATUS.ACTIVE},
                                        );
                                        let nft = await nftRepository.findById(serial.nft_id._id);

                                        if (nft) {
                                            let serialList = await serialRepository.findAllSerialWithCondition(
                                                {
                                                    nft_id: nft._id,
                                                    status: consts.SERIAL_STATUS.ACTIVE,
                                                },
                                            );
                                            let quantitySelling = calcQuantitySellingNumber(
                                                serialList,
                                            );

                                            let quantity = await serialRepository.count({
                                                nft_id: nft._id,
                                            });
                                            await nftRepository.update(nft._id, {
                                                quantity_selling: quantitySelling,
                                                quantity: quantity,
                                                status: consts.NFT_STATUS.ACTIVE,
                                            });
                                        }
                                    }
                                } else if (
                                    result[i].topics[2] ==
                                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                                ) {
                                    // burn
                                    let userAddress = toAddress(result[i].topics[1]);
                                    let tokenId = web3.utils.hexToNumber(result[i].topics[3]);
                                    tokenId = '0x' + tokenId.toString(16);
                                    console.log('burn, from owner:', userAddress);
                                    console.log('tokenid:', tokenId);
                                    console.log('transactionHash', result[i].transactionHash);

                                    // save tokenID
                                    let listener_save = {
                                        token_id: parseInt(tokenId.replace('0x', ''), 16),
                                        tx_id: result[i].transactionHash,
                                        type: consts.LISTENER_TYPE.BURN,
                                        contract_address: contract.toLowerCase(),
                                        collection_id: collectionId
                                    };
                                    await listenerRepository.create(listener_save);

                                    // suspend serial
                                    let serial = await serialRepository.findOneSerial({
                                        token_id: tokenId,
                                        owner: null,
                                    });
                                    if (serial) {
                                        let nft = await nftRepository.findById(serial.nft_id._id);
                                        if (nft) {
                                            let serialList = await serialRepository.findAllSerialWithCondition(
                                                {
                                                    nft_id: nft._id,
                                                    status: consts.SERIAL_STATUS.ACTIVE,
                                                },
                                            );
                                            let quantitySelling = calcQuantitySellingNumber(
                                                serialList,
                                            );
                                            await nftRepository.update(nft._id, {
                                                quantity_selling: quantitySelling,
                                            });
                                            // suspend serial
                                            await serialRepository.update(
                                                {_id: serial._id},
                                                {status: consts.SERIAL_STATUS.SUSPEND},
                                            );
                                        }
                                    }
                                } else {
                                    // buy or airdrop nft
                                    let tokenId = web3.utils.hexToNumber(result[i].topics[3]);
                                    tokenId = '0x' + tokenId.toString(16);
                                    console.log(
                                        'transfer, from owner:',
                                        toAddress(result[i].topics[1]),
                                        ' to new owner:',
                                        toAddress(result[i].topics[2]),
                                    );
                                    console.log('tokenid:', tokenId);
                                    console.log('transactionHash', result[i].transactionHash);

                                    let tx = await txRepository.findOneTx({
                                        tx_id: result[i].transactionHash,
                                    });
                                    console.log("tx::::", tx);
                                    let serial = await serialRepository.findOneSerial({
                                        token_id: tokenId,
                                        transfered: consts.TRANSFERED.NOT_TRANSFER,
                                        owner_id: tx.buyer,
                                        status: {
                                            $in: [
                                                consts.SERIAL_STATUS.INACTIVE,
                                                consts.SERIAL_STATUS.ACTIVE,
                                            ],
                                        },
                                    });
                                    // console.log("serial::::", serial);

                                    if (serial && tx) {
                                        await serialRepository.update(
                                            {_id: serial._id},
                                            {transfered: consts.TRANSFERED.TRANSFERED, tx_id: tx.tx_id},
                                        );
                                        await txRepository.update(
                                            {_id: tx._id},
                                            {
                                                status: consts.TRANSACTION_STATUS.SUCCESS,
                                            },
                                        );
                                    }
                                }
                            }
                            // keccak hash : TransferSingle(address,address,address,uint256,uint256)
                            else if (
                                result[i].topics[0] ==
                                '0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62'
                            ) {
                                // transfer
                                if (
                                    result[i].topics[2] ==
                                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                                ) {
                                    // mint
                                    let userAddress = toAddress(result[i].topics[3]);
                                    // let tokenId = web3.utils.hexToNumber(result[i].topics[3]);
                                    // tokenId = '0x' + tokenId.toString(16);
                                    const data = web3.eth.abi.decodeParameters(['uint256', 'uint256'], result[i].data);
                                    let tokenId = '0x' + data[0].toString(16);
                                    let amount = data[1];
                                    console.log('mint, new owner:', userAddress);
                                    console.log('tokenid:', tokenId);
                                    console.log('amount:', amount);
                                    console.log('transactionHash', result[i].transactionHash);

                                    // save tokenID
                                    // TODO: 2021.12.28 추후 수정할 수 도있음. 지금은 DB에 직접 contract를 추가하도록 한다.
                                    // let contract = await contractRepository.findByContractAddress(contractAddress);
                                    // let contractId = new ObjectID(contract._id);
                                    let listener_save = {
                                        token_id: parseInt(tokenId.replace('0x', ''), 16),
                                        tx_id: result[i].transactionHash,
                                        type: consts.LISTENER_TYPE.MINT,
                                        // contract_id: contractId,
                                        contract_address: contract.toLowerCase(),
                                        collection_id: collectionId
                                    };

                                    await listenerRepository.create(listener_save);

                                    // active nft
                                    // let serial = await serialRepository.findOneSerial({
                                    //     token_id: tokenId,
                                    //     owner: null,
                                    //     status: consts.SERIAL_STATUS.INACTIVE,
                                    // });
                                    let serials = await serialRepository.findAllSerialWithCondition({
                                        token_id: tokenId,
                                        owner_id: null,
                                        status: consts.SERIAL_STATUS.INACTIVE,
                                    });
                                    console.log('====>', serials)
                                    if (serials) {
                                        // active serial
                                        let ids = [];
                                        for (let i = 0; i < amount; i++) {
                                            ids.push(serials[i]._id);
                                        }
                                        await serialRepository.update(
                                            {_id: {$in: ids}},
                                            {status: consts.SERIAL_STATUS.ACTIVE},
                                        );

                                        // let nft = await nftRepository.findById(serial.nft_id._id);
                                        let nft = await nftRepository.findById(serials[0].nft_id._id);

                                        if (nft) {
                                            let serialList = await serialRepository.findAllSerialWithCondition(
                                                {
                                                    nft_id: nft._id,
                                                    status: consts.SERIAL_STATUS.ACTIVE,
                                                },
                                            );
                                            let quantitySelling = calcQuantitySellingNumber(
                                                serialList,
                                            );

                                            let quantity = await serialRepository.count({
                                                nft_id: nft._id,
                                            });
                                            await nftRepository.update(nft._id, {
                                                quantity_selling: quantitySelling,
                                                quantity: quantity,
                                                status: consts.NFT_STATUS.ACTIVE,
                                            });
                                        }
                                    }
                                } else if (
                                    result[i].topics[3] ==
                                    '0x0000000000000000000000000000000000000000000000000000000000000000'
                                ) {
                                    // burn
                                    let userAddress = toAddress(result[i].topics[2]);
                                    // let tokenId = web3.utils.hexToNumber(result[i].topics[3]);
                                    // tokenId = '0x' + tokenId.toString(16);
                                    const data = web3.eth.abi.decodeParameters(['uint256', 'uint256'], result[i].data);
                                    let tokenId = '0x' + data[0].toString(16);
                                    let amount = data[1];
                                    console.log('burn, from owner:', userAddress);
                                    console.log('tokenid:', tokenId);
                                    console.log('transactionHash', result[i].transactionHash);

                                    // save tokenID
                                    let listener_save = {
                                        token_id: parseInt(tokenId.replace('0x', ''), 16),
                                        tx_id: result[i].transactionHash,
                                        type: consts.LISTENER_TYPE.BURN,
                                        contract_address: contract.toLowerCase(),
                                        collection_id: collectionId
                                    };
                                    await listenerRepository.create(listener_save);

                                    // suspend serial
                                    let serial = await serialRepository.findOneSerial({
                                        token_id: tokenId,
                                        owner: null,
                                    });
                                    if (serial) {
                                        let nft = await nftRepository.findById(serial.nft_id._id);
                                        if (nft) {
                                            let serialList = await serialRepository.findAllSerialWithCondition(
                                                {
                                                    nft_id: nft._id,
                                                    status: consts.SERIAL_STATUS.ACTIVE,
                                                },
                                            );
                                            let quantitySelling = calcQuantitySellingNumber(
                                                serialList,
                                            );
                                            await nftRepository.update(nft._id, {
                                                quantity_selling: quantitySelling,
                                            });
                                            // suspend serial
                                            await serialRepository.update(
                                                {_id: serial._id},
                                                {status: consts.SERIAL_STATUS.SUSPEND},
                                            );
                                        }
                                    }
                                } else {
                                    // buy or airdrop nft
                                    // let tokenId = web3.utils.hexToNumber(result[i].topics[3]);
                                    // tokenId = '0x' + tokenId.toString(16);
                                    const data = web3.eth.abi.decodeParameters(['uint256', 'uint256'], result[i].data);
                                    let tokenId = '0x' + data[0].toString(16);
                                    let amount = data[1];
                                    console.log(
                                        'transfer, from owner:',
                                        toAddress(result[i].topics[2]),
                                        ' to new owner:',
                                        toAddress(result[i].topics[3]),
                                    );
                                    console.log('tokenid:', tokenId);
                                    console.log('amount:', amount);
                                    console.log('transactionHash', result[i].transactionHash);

                                    let tx = await txRepository.findOneTx({
                                        tx_id: result[i].transactionHash,
                                    });
                                    console.log("tx::::", tx);
                                    // let serial = await serialRepository.findOneSerial({
                                    //     token_id: tokenId,
                                    //     transfered: consts.TRANSFERED.NOT_TRANSFER,
                                    //     owner_id: tx.buyer,
                                    //     status: {
                                    //         $in: [
                                    //             consts.SERIAL_STATUS.INACTIVE,
                                    //             consts.SERIAL_STATUS.ACTIVE,
                                    //         ],
                                    //     },
                                    // });
                                    let serials = await serialRepository.findAllSerialWithCondition({
                                        token_id: tokenId,
                                        transfered: consts.TRANSFERED.NOT_TRANSFER,
                                        owner_id: tx.buyer,
                                        status: {
                                            $in: [
                                                consts.SERIAL_STATUS.INACTIVE,
                                                consts.SERIAL_STATUS.ACTIVE,
                                            ],
                                        },
                                    });
                                    // console.log("serial::::", serial);

                                    // if (serial && tx) {
                                    if (serials && tx) {
                                        let ids = [];
                                        serials.forEach((serial) => {
                                            ids.push(serial._id);
                                        })
                                        await serialRepository.update(
                                            // {_id: serial._id},
                                            {_id: {$in: ids}},
                                            {transfered: consts.TRANSFERED.TRANSFERED, tx_id: tx.tx_id},
                                        );
                                        await txRepository.update(
                                            {_id: tx._id},
                                            {
                                                status: consts.TRANSACTION_STATUS.SUCCESS,
                                            },
                                        );
                                    }
                                }
                            }
                            else if (result[i].topics[0] == '0x000000') {
                                // approve chưa biết mã topic nên chưa xong
                            }
                        }
                    }
                }

                lastBlock = toBlock + 1;
                saveConf();
                return true;
            }
            console.log(err);
        },
    );
}

// init
loadConf();

// set timer to get events every 2 seconds
setInterval(function () {
    getLastEvents();
}, 2000);
