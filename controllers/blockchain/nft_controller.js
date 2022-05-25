const axios = require('axios');
const logger = require('../../utils/logger');
const Web3 = require('web3');
const CaverExtKAS = require('caver-js-ext-kas');
const nftAbi = require('../../config/abi/kip17.json');
const marketAbi = require('../../config/abi/marketV3.json');
require('dotenv').config();

const web3 = new Web3(process.env.PROVIDER_URL);
const chainId = process.env.KLAYTN_CHAIN_ID | 0;
const accessKeyId = process.env.ACCESS_KEY_ID;
const secretAccessKey = process.env.SECRET_ACCESS_KEY;
const contractAddress = process.env.NFT_CONTRACT_ADDR;

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
const {getMarketAddress} = require('../../utils/getMarketAddress');

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

    _burn17: async (contract, from, tokenId) => {
        try {
            let result = await caver.kas.kip17.burn(contract, from, parseInt(tokenId));
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
        const url = `https://th-api.klaytnapi.com/v2/account/${address}/token?kind=nft&size=${size}&cursor=${cursor}`;
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

        const marketAddress = getMarketAddress(collection.network);

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
    _sellNFT: async (network, collectionAddress, tokenId, price, quote, marketAddress) => {
        console.log()
        let receipt;
        if (network === 'klaytn') {
            const gasPrice = await caver.klay.getGasPrice();
            const parsedPrice = caver.utils.convertToPeb(price, 'KLAY');
            const accounts = await caver.kas.wallet.getAccountList();
            const kasAddr = accounts.items[0].address;
            try {
                const marketContract = new caver.contract(marketAbi, marketAddress);
                const gasLimit = await marketContract.methods.readyToSellToken(collectionAddress, tokenId, parsedPrice, quote)
                    .estimateGas({
                        from: kasAddr
                    });

                receipt = await marketContract.methods.readyToSellToken(collectionAddress, tokenId, parsedPrice, quote).send({
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
        } else {
            // TODO : for Ethereum & Binance ... need to use multicall
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

    burn17: async (req, res, next) => {
        let contract = req.body.contract_address;
        let from = req.body.from;
        let tokenId = req.body.token_id;

        let burnResult = await module.exports._burn17(contract, from, tokenId);
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

    _getAllTokens: async (contractAddress) => {
        console.log('hi there.', contractAddress);
        // const result = await caver.kas.kip17.getTokenList(contractAddress, {size: 5, cursor: undefined});
        const tokens = [];
        let cursor = '';
        do {
            const result = await caver.kas.kip17.getTokenList(contractAddress, {size: 1000, cursor});
            if (result.items.length > 0)
                tokens.push(...result.items);
            cursor = result.cursor;
        } while (cursor !== '');

        return tokens;
    },
    _getAllTokensWeb3: async (contractAddress) => {
        const nftContract = new web3.eth.Contract(nftAbi, contractAddress)
        // const symbol = await nftContract.methods.symbol().call();
        const totalSupply = await nftContract.methods.totalSupply().call();
        const tokens = [];
        for (let i = 0; i < totalSupply; i++) {
            try {
                let tokenId = await nftContract.methods.tokenByIndex(i).call();
                let tokenUri = await nftContract.methods.tokenURI(tokenId).call();
                let owner = await nftContract.methods.ownerOf(tokenId).call();
                tokenId = '0x' + parseInt(tokenId).toString(16);
                tokens.push({tokenId, tokenUri, owner});
                // tokenURI = tokenURI.replace('https://ipfs.io', 'https://infura-ipfs.io');
                // const tokenInfo = await module.exports._getTokenInfo(tokenURI);
                // console.log(i, tokenURI, tokenInfo.data, tokenOwner);
            } catch (e) {
                console.log(e);
            }
        }
        return tokens;
    },
    _getTokenInfo: async (tokenURI) => {
        const config = {
            method: 'get',
            url: tokenURI,
            headers: {
                'Content-Type': 'application/json'
            }
        }
        return axios(config);
    }
};
