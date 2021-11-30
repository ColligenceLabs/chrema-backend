var {CompanyModel} = require('../models');
var consts = require('../utils/consts');

module.exports = {
    findById: async function (id) {
        let company = await CompanyModel.findOne({_id: id});
        if (!company) {
            return null;
        }
        return company;
    },

    findAll: async function (findParams, pagination) {
        try {
            let company = await CompanyModel.find(findParams)
                .skip((pagination.page - 1) * pagination.perPage)
                .limit(pagination.perPage)
                .sort({createdAt: -1, _id: 1});
            return company;
        } catch (error) {
            return error;
        }
    },

    create: async function (input) {
        try {
            let company = await CompanyModel.create(input);
            return company;
        } catch (error) {
            return error;
        }
    },

    updateById: async function (id, where) {
        try {
            let company = await CompanyModel.updateOne({_id: id}, {$set: where});
            return company;
        } catch (error) {
            return error;
        }
    },

    findByName: async function (name) {
        try {
            let company = await CompanyModel.find({name: name}).sort({createdAt: -1, _id: 1});
            return company;
        } catch (error) {
            return error;
        }
    },

    count: async function (where) {
        try {
            let count = await CompanyModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },

    delete: async function (id) {
        try {
            let deleteDocument = await CompanyModel.deleteOne({_id: id});
            return deleteDocument;
        } catch (error) {
            return error;
        }
    },
};
