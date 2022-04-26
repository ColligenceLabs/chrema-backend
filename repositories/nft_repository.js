const {NftModel, SerialModel, UserModel} = require('../models');
var consts = require('../utils/consts');
const {addMongooseParam} = require('../utils/helper');
var request = require('request');
var fs = require('fs');
var nftBlockchain = require('../controllers/blockchain/nft_controller');
const mongoose = require('mongoose');

module.exports = {
    findById: async function (id) {
        let nft = await NftModel.findOne({
            _id: id,
        })
            .populate({path: 'creator_id'})
            .populate({path: 'collection_id'});
        if (!nft) {
            return null;
        }
        return nft;
    },
    findAll: async function (findParams, pagination = null) {
        try {
            if (pagination) {
                var nfts = await NftModel.find(findParams)
                    .skip((pagination.page - 1) * pagination.perPage)
                    .limit(pagination.perPage)
                    .sort({createdAt: -1, start_date: -1, _id: 1})
                    .populate({path: 'collection_id'})
                    .populate({path: 'creator_id'});
            } else {
                var nfts = await NftModel.find(findParams)
                    .sort({createdAt: -1, start_date: -1, _id: 1})
                    .populate({path: 'collection_id'})
                    .populate({path: 'creator_id'});
            }
            return nfts;
        } catch (error) {
            return error;
        }
    },
    findAllExt: async function (findParams, pagination = null, flCreatedAt, flPrice) {
        try {
            if (pagination) {
                if (flCreatedAt == 0) {
                    var nfts = await NftModel.find(findParams)
                        .skip((pagination.page - 1) * pagination.perPage)
                        .limit(pagination.perPage)
                        .sort({price: flPrice})
                        .populate({path: 'collection_id'})
                        .populate({path: 'creator_id'});
                } else {
                    var nfts = await NftModel.find(findParams)
                        .skip((pagination.page - 1) * pagination.perPage)
                        .limit(pagination.perPage)
                        .sort({createdAt: flCreatedAt})
                        .populate({path: 'collection_id'})
                        .populate({path: 'creator_id'});
                }
            } else {
                if (flCreatedAt == 0) {
                    var nfts = await NftModel.find(findParams)
                        .sort({price: flPrice})
                        .populate({path: 'collection_id'})
                        .populate({path: 'creator_id'});
                } else {
                    var nfts = await NftModel.find(findParams)
                        .sort({createdAt: flCreatedAt})
                        .populate({path: 'collection_id'})
                        .populate({path: 'creator_id'});
                }
            }
            return nfts;
        } catch (error) {
            return error;
        }
    },
    findRandom: async function (findParams) {
        try {
            var nfts = await NftModel.find(findParams)
                // .limit(4)
                // .sort({createdAt: -1, start_date: -1, _id: 1})
                .populate({path: 'collection_id'})
                .populate({path: 'creator_id'});
            nfts.sort(() => Math.random() - Math.random());
            return nfts.slice(0, 4);
        } catch (error) {
            return error;
        }
    },
    findIdsNftByName: async function (name) {
        const findByName = {};
        const findByDesc = {};
        const findByMetadataName = {};

        findByName.name = addMongooseParam(findByName.name, '$regex', new RegExp(name, 'i'));

        findByMetadataName['metadata.name'] = addMongooseParam(
            findByMetadataName['metadata.name'],
            '$regex',
            new RegExp(name, 'i'),
        );

        findByDesc.description = addMongooseParam(
            findByDesc.description,
            '$regex',
            new RegExp(name, 'i'),
        );

        const findParams = {
            $or: [findByName, findByDesc, findByMetadataName],
        };

        try {
            const nfts = await NftModel.find(findParams).lean();
            const ids = [];

            nfts.map((item) => {
                ids.push(item._id);
            });

            return ids;
        } catch (error) {
            return null;
        }
    },

    findAllNftsByCollectionId: async function (id) {
        let nfts = await NftModel.find({collection_id: id});
        if (!nfts) {
            return null;
        }
        return nfts;
    },
    findAllOnchainNftsByCollectionId: async function (id) {
        let nfts = await NftModel.find({collection_id: id, onchain: 'true'}).sort({createdAt: -1});
        if (!nfts) {
            return null;
        }
        return nfts;
    },
    findAllWithArrayIds: async function (ids) {
        try {
            let users = await NftModel.find({_id: {$in: ids}});
            return users;
        } catch (error) {
            return error;
        }
    },
    findOneNft: async function (where) {
        let nft = await NftModel.findOne(where);
        if (!nft) {
            return null;
        }
        return nft;
    },
    count: async function (where) {
        try {
            let count = await NftModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },
    create: async function (newNft, inputSerial, tokenIds, ipfs_links) {
        try {
            let nft = await NftModel.create(newNft);
            let newSerial = {
                nft_id: nft._id,
                ...inputSerial,
            };
            for (let i = 0; i < nft.quantity; i++) {
                newSerial.index = i + 1;
                newSerial.transfered = consts.TRANSFERED.NOT_TRANSFER;
                newSerial.token_id = tokenIds[i];
                newSerial.ipfs_link = ipfs_links[i];
                await SerialModel.create(newSerial);
            }

            return nft;
        } catch (error) {
            return error;
        }
    },
    createWithoutSerial: async function (newNft) {
        try {
            let nft = await NftModel.create(newNft);
            return nft;
        } catch (error) {
            return error;
        }
    },
    createByWallet: async function (newNft, inputSerial, tokenIds, ipfs_links, type) {
        try {
            let nft = await NftModel.create(newNft);
            console.log(nft);
            let newSerial = {
                nft_id: nft._id,
                ...inputSerial,
            };
            for (let i = 0; i < nft.quantity; i++) {
                newSerial.index = i + 1;
                newSerial.transfered = consts.TRANSFERED.NOT_TRANSFER;
                newSerial.price = nft.price;
                newSerial.quote = nft.quote;
                newSerial.token_id = type === 'KIP17' ? tokenIds[i] : tokenIds[0];
                newSerial.ipfs_link = type === 'KIP17' ? ipfs_links[i] : ipfs_links[0];
                await SerialModel.create(newSerial);
            }

            return nft;
        } catch (error) {
            return error;
        }
    },
    update: async function (id, where) {
        try {
            let nft = await NftModel.updateOne({_id: id}, {$set: where});
            return nft;
        } catch (error) {
            return error;
        }
    },
    updateQuantitySelling: async function (id, count) {
        try {
            let nft = await NftModel.updateOne({_id: id}, {$inc: {quantity_selling: count}});
            return nft;
        } catch (error) {
            return error;
        }
    },

    delete: async function (id, where) {
        try {
            let nft = await NftModel.updateOne({_id: id}, {$set: where});
            return nft;
        } catch (error) {
            return error;
        }
    },
    deleteMany: async function (ids, admin_address) {
        try {
            let result = [];
            await NftModel.updateMany(
                {_id: {$in: ids}},
                {$set: {status: consts.NFT_STATUS.SUSPEND}},
            );
            for (let i = 0; i < ids.length; i++) {
                let serialList = await SerialModel.find({nft_id: ids[i]});
                for (let j = 0; j < serialList.length; j++) {
                    if (serialList[j].status !== consts.SERIAL_STATUS.SUSPEND) {
                        let ownerId = serialList[j].owner_id;
                        let tokenId = serialList[j].token_id;
                        if (!ownerId) {
                            ownerId = admin_address[0];
                        } else {
                            continue;
                        }
                        let burnResult = await nftBlockchain._burn(
                            ownerId,
                            parseInt(tokenId.replace('0x', ''), 16),
                        );
                        if (burnResult.status !== 200) {
                            return burnResult.error;
                        }
                        await SerialModel.updateOne(
                            {_id: serialList[j]._id},
                            {
                                status: consts.SERIAL_STATUS.SUSPEND,
                            },
                        );

                        result.push(burnResult.result);
                    }
                }
            }
            return result;
        } catch (error) {
            return error;
        }
    },

    updateSchedule: async function (ids, where) {
        try {
            let nft = await NftModel.updateMany({_id: {$in: ids}}, {$set: where});
            return nft;
        } catch (error) {
            return error;
        }
    },

    updateOneSchedule: async function (id, where) {
        try {
            let nft = await NftModel.updateMany({_id: id}, {$set: where});
            return nft;
        } catch (error) {
            return error;
        }
    },

    addFileToIPFS: async function (my_file) {
        // console.log("start file upload to ipfs...")
        var auth =
            'Basic ' +
            Buffer.from(consts.IPFS.INFURA_IPFS_PROJECT_ID + ':' + consts.IPFS.INFURA_IPFS_PROJECT_SECRET).toString(
                'base64',
            );
        var options = {
            method: 'POST',
            url: 'https://ipfs.infura.io:5001/api/v0/add',
            headers: {
                Authorization: auth,
            },
            formData: {
                file: {
                    value: fs.createReadStream(my_file.path),
                    options: {
                        filename: my_file.originalname,
                        contentType: null,
                    },
                },
            },
        };

        let getResponse = await new Promise(function (resolve, reject) {
            request(options, async function (error, response) {
                if (!error && response.statusCode == 200) {
                    // console.log("add file to ipfs success")
                    resolve(response.body);
                } else {
                    reject(error);
                }
            });
        });
        getResponse = JSON.parse(getResponse);
        return getResponse;
    },

    addJsonToIPFS: async function (metadata) {
        // console.log("start json upload to ipfs...")
        var auth =
            'Basic ' +
            Buffer.from(consts.IPFS.INFURA_IPFS_PROJECT_ID + ':' + consts.IPFS.INFURA_IPFS_PROJECT_SECRET).toString(
                'base64',
            );

        var options = {
            method: 'POST',
            url: 'https://ipfs.infura.io:5001/api/v0/add',
            headers: {
                Authorization: auth,
            },
            formData: {
                file: JSON.stringify(metadata),
            },
        };

        let getResponse = await new Promise(function (resolve, reject) {
            request(options, async function (error, response) {
                if (!error && response.statusCode == 200) {
                    // console.log("add json to ipfs success")
                    resolve(response.body);
                } else {
                    reject(error);
                }
            });
        });

        getResponse = JSON.parse(getResponse);
        return getResponse;
    },

    getItemList: async function () {
        var request = require('request');
        var options = {
            method: 'GET',
            url:
                consts.BCN_KLAYTN_URL +
                'getTokenListKip17?contractAddress=' +
                consts.NFT_CONTRACT_ADDR,
            headers: {
                'x-api-key': 'd37b7327-1657-42f0-8066-e8ebb65fefaa',
            },
        };
        let itemList = await new Promise(function (resolve) {
            request(options, function (error, response) {
                if (error) throw new Error(error);
                resolve(response.body);
            });
        });
        itemList = JSON.parse(itemList);
        return itemList;
    },

    findByIds: async function (ids) {
        let nfts = await NftModel.find({_id: {$in: ids}});
        if (!nfts) {
            return null;
        }
        return nfts;
    },

    getNewNfts: async function (where) {
        let nfts = await NftModel.find(where).limit(2).sort({start_date: -1, _id: 1});
        if (!nfts) {
            return null;
        }
        return nfts;
    },

    findQuantitySelling: async function (where) {
        let nfts = await NftModel.findOne(where,{quantity_selling: 1});
        if (!nfts) {
            return null;
        }
        return nfts;
    },
};
