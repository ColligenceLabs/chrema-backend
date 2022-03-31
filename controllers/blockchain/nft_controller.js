const axios = require('axios');
const logger = require('../../utils/logger');
const CaverExtKAS = require('caver-js-ext-kas');
const marketAbi = require('../../config/abi/market.json');
require('dotenv').config();

const chainId = process.env.KLAYTN_CHAIN_ID | 0;
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const contractAddress = process.env.NFT_CONTRACT_ADDR;
const marketAddress = process.env.MARKET_CONTRACT_ADDRESS;
// 테스트필요
// const option = {
//     headers: [
//         // { name: 'Authorization', value: 'Basic ' + Buffer.from(accessKeyId + ':' + secretAccessKey).toString('base64') },
//         // { name: 'x-chain-id', value: chainId },
//         { name: "x-krn", value:"krn:8217:wallet:ebf2bc57-9c0f-48f7-afc5-e260cbb57ec3:account-pool:NFTMarketplace" },
//     ]
// }

const caver = new CaverExtKAS(chainId, accessKeyId, secretAccessKey);

var {handlerSuccess, handlerError} = require('../../utils/handler_response');

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// add 10%
function calculateGasMargin(value) {
    return value.mul(caver.utils.toBN(10000).add(caver.utils.toBN(1000))).div(caver.utils.toBN(10000));
}

module.exports = {
    classname: 'NftController',

    // ========================= INTERNAL FUNCTIONS ============================
    _tokenList: async (size, cursor) => {
        try {
            const query = {size: size ? parseInt(size) : 100, cursor: cursor ? cursor : ''};
            try {
                const result = await caver.kas.kip17.getTokenList(contractAddress, query);
                return {status: 200, result: result};
            } catch (error) {
                return {status: 500, error: error};
            }
        } catch (error) {
            console.log(error);
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _mint: async (to, tokenId, tokenUri) => {
        try {
            let result = await caver.kas.kip17.mint(
                contractAddress,
                to,
                parseInt(tokenId),
                tokenUri,
            );
            return {status: 200, result: result};
        } catch (error) {
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _deploy17: async (name, symbol, alias) => {
        try {
            let result = await caver.kas.kip17.deploy(
                name,
                symbol,
                alias
            );

            let newContract = '';
            do {
                const contracts = await caver.kas.kip17.getContractList();
                contracts.items.map((contract) => {
                    if (contract.alias === alias) {
                        if (contract.address !== 'updateme') {
                            newContract = contract.address;
                        } else {

                        }
                    }
                })
                await sleep(3000);
            } while(newContract === '')
            return {status: 200, address: newContract};
        } catch (error) {
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _deploy37: async (nuri, alias) => {
        try {
            let result = await caver.kas.kip37.deploy(
                uri,
                alias
            );

            let newContract = '';
            do {
                const contracts = await caver.kas.kip37.getContractList();
                contracts.items.map((contract) => {
                    if (contract.alias === alias) {
                        if (contract.address !== 'updateme') {
                            newContract = contract.address;
                        } else {

                        }
                    }
                })
                await sleep(3000);
            } while(newContract === '')
            return {status: 200, address: newContract};
        } catch (error) {
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _mint17: async (contract, to, tokenId, tokenUri) => {
        try {
            let result = await caver.kas.kip17.mint(
                contract,
                to,
                parseInt(tokenId),
                tokenUri,
            );
            return {status: 200, result: result};
        } catch (error) {
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _mint37: async (contract, to, tokenId, amount) => {
        try {
            let result = await caver.kas.kip37.mint(
                contract,
                to,
                parseInt(tokenId),
                amount,
            );
            return {status: 200, result: result};
        } catch (error) {
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _burn: async (from, tokenId) => {
        try {
            let result = await caver.kas.kip17.burn(contractAddress, from, parseInt(tokenId));
            return {status: 200, result: result};
        } catch (error) {
            console.log(error);
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _transfer: async (from, owner, to, tokenId) => {
        try {
            let result = await caver.kas.kip17.transfer(
                contractAddress,
                from,
                owner,
                to,
                parseInt(tokenId),
            );
            return {status: 200, result: result};
        } catch (error) {
            console.log(error);
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _transfer17: async (contract, from, to, tokenId) => {
        const token = await caver.kas.kip17.getToken(contract, tokenId);
        const accounts = await caver.kas.wallet.getAccountList();
        const kasAddr = accounts.items[0].address;

        try {
            let result = await caver.kas.kip17.transfer(
                contract,
                from === kasAddr ? from : kasAddr,
                // token.owner,
                token.owner,
                to,
                parseInt(tokenId),
            );
            // TODO : TX Receipt를 받는 방법은? Wallet API TransactionReceipt는 에러 발생...
            return {status: 200, result: result};
        } catch (error) {
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _transfer37: async (contract, from, to, tokenId, amount) => {
        const token = caver.kas.kip17.getToken(contract, tokenId);

        try {
            let result = await caver.kas.kip37.transfer(
                contract,
                // from,
                token.owner,
                token.owner,
                to,
                parseInt(tokenId),
                amount
            );
            return {status: 200, result: result};
        } catch (error) {
            console.log(error);
            logger.error(new Error(error));
            return {status: 500, error: error};
        }
    },

    _userNFTs: async (address, size, cursor) => {
        const url = `https://th-api.klaytnapi.com/v2/account/${address}/token?kind=nft&size=${size}`;
        const config = {
            method: 'get',
            url: url,
            auth: {
                username: accessKeyId,
                password: secretAccessKey
            },
            headers: {
                'x-chain-id': chainId,
                'Content-Type': 'application/json'
            }
        }
        try {
            const result = await axios(config);
            return result;
        } catch (error) {
            logger.error(new Error(error));
            return error;
        }
    },
    _approveSellNFTs: async (collection, serials) => {
        const accounts = await caver.kas.wallet.getAccountList();
        const kasAddr = accounts.items[0].address;

        for (let i=0; i < serials.length; i++) {
            try {
                await caver.kas.kip17.approve(collection.contract_address, kasAddr, marketAddress, serials[i].token_id);
            } catch (e) {
                console.log('approve fail', e);
                logger.error(new Error(e));
            }
        }
        await sleep(2000);
        return {status: 200, result: 1};
    },
    _sellNFT: async (collectionAddress, tokenId, price) => {
        const gasPrice = await caver.klay.getGasPrice();
        const parsedPrice = caver.utils.convertToPeb(price, 'KLAY');
        const accounts = await caver.kas.wallet.getAccountList();
        const kasAddr = accounts.items[0].address;
        let receipt;
        try {
            const marketContract = new caver.contract(marketAbi, marketAddress);
            const gasLimit = await marketContract.methods.readyToSellToken(collectionAddress, tokenId, parsedPrice)
                .estimateGas({
                    from: kasAddr
                });

            receipt = await marketContract.methods.readyToSellToken(collectionAddress, tokenId, parsedPrice).send({
                from: kasAddr,
                gasPrice,
                gasLimit: calculateGasMargin(caver.utils.toBN(gasLimit)).toString(),
            });
            // console.log('success readyToSellToken', receipt);
        } catch (e) {
            console.log(e);
            logger.error(new Error(e));
            return {status: 500, error: e}
        }

        return {status: 200, result: receipt.transactionHash};
    },

    // ========================= FOR TESTING ============================
    tokenList: async (req, res, next) => {
        let size = req.query.size;
        let cursor = req.query.cursor;

        let itemList = await module.exports._tokenList(size, cursor);
        if (itemList.status == 200) {
            return handlerSuccess(req, res, itemList.result);
        } else {
            return handlerError(req, res, {error: itemList.error});
        }
    },

    mint: async (req, res, next) => {
        let to = req.body.to;
        let tokenId = req.body.token_id;
        let tokenUri = req.body.token_uri;

        let mintResult = await module.exports._mint(to, tokenId, tokenUri);
        if (mintResult.status == 200) {
            console.log(mintResult.result);
            return handlerSuccess(req, res, mintResult.result);
        } else {
            return handlerError(req, res, {error: mintResult.error});
        }
    },

    burn: async (req, res, next) => {
        let from = req.body.from;
        let tokenId = req.body.token_id;

        let burnResult = await module.exports._burn(from, tokenId);
        if (burnResult.status == 200) {
            console.log(burnResult.result);
            return handlerSuccess(req, res, burnResult.result);
        } else {
            return handlerError(req, res, {error: burnResult.error});
        }
    },

    transfer: async (req, res, next) => {
        let from = req.body.from;
        let owner = req.body.owner;
        let to = req.body.to;
        let tokenId = req.body.token_id;

        let transferResult = await module.exports._transfer(from, owner, to, tokenId);
        if (transferResult.status == 200) {
            console.log(transferResult.result);
            return handlerSuccess(req, res, transferResult.result);
        } else {
            return handlerError(req, res, {error: transferResult.error});
        }
    },
};
