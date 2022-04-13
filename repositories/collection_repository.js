const {CollectionModel, AdminModel, CompanyModel, NftModel, ContractModel} = require('../models');
const nftRepository = require('./nft_repository');
const {addMongooseParam} = require('../utils/helper');

module.exports = {
    findById: async function (id) {
        let collection = await CollectionModel.findOne({_id: id}).populate({
            path: 'creator_id',
            select: ['full_name', 'image'],
        });
        if (!collection) {
            return null;
        }
        return collection;
    },

    findByIds: async function (ids) {
        let collection = await CollectionModel.find({_id: {$in: ids}}).populate({
            path: 'creator_id',
            select: 'name',
        });
        if (!collection) {
            return null;
        }
        return collection;
    },

    findAll: async function (findParams, pagination) {
        try {
            let collections = await CollectionModel.find(findParams)
                .skip((pagination.page - 1) * pagination.perPage)
                .limit(pagination.perPage)
                .sort({createdAt: -1, _id: 1})
                .populate({path: 'creator_id', select: ['full_name', 'image']});
            return collections;
        } catch (error) {
            return error;
        }
    },

    findOnSale: async function (findParams) {
        try {
            let collections = await CollectionModel.find(findParams)
                .sort({createdAt: -1, _id: 1})
                .populate({path: 'creator_id', select: ['full_name', 'image']});
            return collections;
        } catch (error) {
            return error;
        }
    },

    findByCompanyName: async function (name) {
        const findParams = {};
        findParams.name = addMongooseParam(findParams.name, '$regex', name);

        try {
            const companies = await CompanyModel.find(findParams).lean();
            const ids = [];

            companies.map((item) => {
                ids.push(item._id);
            });

            return ids;
        } catch (error) {
            return null;
        }
    },

    findByCreatorName: async function (name) {
        const findParams = {};
        findParams.name = addMongooseParam(findParams.name, '$regex', name);

        try {
            const creators = await AdminModel.find(findParams).lean();
            const ids = [];

            creators.map((item) => {
                ids.push(item._id);
            });

            return ids;
        } catch (error) {
            return null;
        }
    },

    findByCreatorId: async function (id) {
        const collections = await CollectionModel.find({creator_id: id});

        if (!collections) {
            return null;
        }
        return collections;
    },

    count: async function (where) {
        try {
            let count = await CollectionModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },

    create: async function (newCollection) {
        let collection = await CollectionModel.create(newCollection);
        if (!collection) {
            return null;
        }
        return {
            _id: collection.id,
            name: collection.name,
            cover_image: collection.cover_image,
            description: collection.description,
            company_id: collection.company_id,
            creator_id: collection.creator_id,
            contract_address: collection.contract_address,
            category: collection.category,
            nft_id: collection.nft_id,
            status: collection.status,
            createdAt: collection.createdAt,
            updatedAt: collection.updatedAt,
        };
    },

    updateById: async function (id, where) {
        try {
            let collection = await CollectionModel.updateOne({_id: id}, {$set: where});
            return collection;
        } catch (error) {
            return error;
        }
    },

    update: async function (findParams, where) {
        try {
            let collection = await CollectionModel.updateMany(findParams, {$set: where});
            return collection;
        } catch (error) {
            return error;
        }
    },

    getContracts: async function () {
        try {
            let collections = await CollectionModel.find();
            const contracts = [];

            collections.map((item) => {
                if (item.contract_address !== 'undefined' && item.contract_type !== 'SPLToken') {
                    contracts.push(item.contract_address);
                }
            });
            return contracts;
        } catch (error) {
            return error;
        }
    },

    findByContractAddress: async function (contractAddress) {
        // let collection = await CollectionModel.findOne({contract_address: contractAddress});
        // Double Check : contract_address from KAS API is lower case
        let collection = await CollectionModel.findOne({
            $or: [
                { contract_address: contractAddress },
                { contract_address: contractAddress.toLowerCase() }
            ]
        });
        if (!collection) { return null; }
        return collection;
    },
};
