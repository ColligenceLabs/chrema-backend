const {CollectionModel, CompanyModel} = require('../models');
const nftRepository = require('./nft_repository');
const {addMongooseParam} = require('../utils/helper');

module.exports = {
    findById: async function (id) {
        let collection = await CollectionModel.findOne({_id: id}).populate({
            path: 'company_id',
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
                .populate({path: 'company_id', select: 'name'});
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
            description: collection.description,
            company_id: collection.company_id,
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
};
