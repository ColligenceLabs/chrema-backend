const logger = require('../../utils/logger');
const CaverExtKAS = require('caver-js-ext-kas');
require('dotenv').config();

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

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
        const token = caver.kas.kip17.getToken(contract, tokenId);

        try {
            let result = await caver.kas.kip17.transfer(
                contract,
                // from,
                token.owner,
                token.owner,
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
