const {AdminModel} = require('../models');
const {ADMIN_FIELD} = require('../utils/consts');

module.exports = {
    findByEmail: async function (email) {
        let admin = await AdminModel.findOne({email: email});
        if (!admin) {
            return null;
        }
        return admin;
    },
    findById: async function (id, select = ADMIN_FIELD) {
        let admin;
        if (select == null) {
            admin = await AdminModel.findOne({_id: id});
        }
        if (select == ADMIN_FIELD) {
            admin = await AdminModel.findOne({_id: id}).select(select);
        }
        if (!admin) {
            return null;
        }
        return admin;
    },
    findByAdminAddress: async function (address) {
        let admin = await AdminModel.findOne({admin_address: address}).select(ADMIN_FIELD);
        if (!admin) {
            return null;
        }
        return admin;
    },
    findAll: async function (findParams, pagination) {
        let admin = await AdminModel.find(findParams)
            .select(ADMIN_FIELD)
            .skip((pagination.page - 1) * pagination.perPage)
            .limit(pagination.perPage)
            .sort({createdAt: -1, _id: 1});

        if (!admin) {
            return null;
        }
        return admin;
    },
    create: async function (newAcc) {
        let admin = await AdminModel.create(newAcc);
        if (!admin) {
            return null;
        }
        return {
            _id: admin.id,
            full_name: admin.full_name,
            email: admin.email,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
        };
    },
    count: async function (where) {
        try {
            let count = await AdminModel.countDocuments(where);
            return count;
        } catch (error) {
            return error;
        }
    },
    update: async function (id, where) {
        try {
            let admin = await AdminModel.updateOne({_id: id}, {$set: where});
            return admin;
        } catch (error) {
            return error;
        }
    },
    updateAll: async function (ids, where) {
        try {
            let admin = await AdminModel.updateMany({_id: {$in: ids}}, {$set: where});
            return admin;
        } catch (error) {
            return error;
        }
    },

    getAdminIds: async function () {
        let admins = await AdminModel.find().sort({createdAt: -1, _id: 1});
        let ids = [];
        admins.forEach((admin) => {
            ids.push(admin._id);
        });

        return ids;
    },

    getAdminAddress: async function () {
        let admins = await AdminModel.find().sort({createdAt: -1, _id: 1});
        let adminAddress = [];
        admins.forEach((admin) => {
            if (!adminAddress.includes(admin.admin_address)) {
                adminAddress.push(admin.admin_address);
            }
        });

        return adminAddress;
    },
};
