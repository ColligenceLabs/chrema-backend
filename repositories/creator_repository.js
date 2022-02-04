var {CreatorModel} = require('../models');
var consts = require('../utils/consts');

module.exports = {
    findById: async function (id) {
        let creator = await CreatorModel.findOne({_id: id});
        if (!creator) {
            return null;
        }
        return creator;
    },

    findAll: async function (findParams, pagination) {
        try {
            let creator = await CreatorModel.find(findParams)
                .skip((pagination.page - 1) * pagination.perPage)
                .limit(pagination.perPage)
                .sort({createdAt: -1, _id: 1});
            return creator;
        } catch (error) {
            return error;
        }
    },

    create: async function (input) {
        try {
            let creator = await CreatorModel.create(input);
            return creator;
        } catch (error) {
            return error;
        }
    },

    updateById: async function (id, where) {
        try {
            let creator = await CreatorModel.updateOne({_id: id}, {$set: where});
            return creator;
        } catch (error) {
            return error;
        }
    },

    findByEmail: async function (email) {
        try {
            let creator = await CreatorModel.find({name: email}).sort({createdAt: -1, _id: 1});
            return creator;
        } catch (error) {
            return error;
        }
    },

    findByName: async function (name) {
        try {
            let creator = await CreatorModel.find({name: name}).sort({createdAt: -1, _id: 1});
            return creator;
        } catch (error) {
            return error;
        }
    },

    count: async function (where) {
        try {
            let count = await CreatorModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },

    delete: async function (id) {
        try {
            let deleteDocument = await CreatorModel.deleteOne({_id: id});
            return deleteDocument;
        } catch (error) {
            return error;
        }
    },
};
