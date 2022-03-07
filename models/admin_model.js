const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const {ADMIN_STATUS} = require('../utils/consts');
const Schema = mongoose.Schema;
let SALT_WORK_FACTOR = 10;

const AdminSchema = new Schema(
    {
        full_name: {
            type: String,
            required: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            unique: true,
            match: [/.+@.+\..+/, 'Địa chỉ email không hợp lệ'],
        },
        password: {
            type: String,
            required: true,
            trim: true,
        },
        admin_address: {
            type: String,
            default: '0x7b8340205dddee16f2f9e582c185ff5f05f4cb6e',
        },
        solana_address: {
            type: String,
            require: false,
            default: '',
        },
        contract_admin_address: {
            type: String,
            default: '',
            // default: '0xc144893e7102a591ac67de1b9e867ae9275b7bf6',
        },
        level: {
            type: String,
            require: true,
            trim: true,
        },
        description: {
            type: String,
        },
        image: {
            type: String,
        },
        status: {
            type: String,
            enum: ADMIN_STATUS,
            default: ADMIN_STATUS.INACTIVE,
        },
        createdAt: {
            type: Date,
            default: Date.now,
        },
        updatedAt: {
            type: Date,
            default: Date.now,
        },
    },
    {usePushEach: true},
);
AdminSchema.index({email: 1}, {background: true});

AdminSchema.pre('save', function (next) {
    var admin = this;
    if (!admin.isModified('password')) return next();
    bcrypt.genSalt(SALT_WORK_FACTOR, function (err, salt) {
        if (err) return next(err);
        bcrypt.hash(admin.password, salt, function (err, hash) {
            if (err) return next(err);
            admin.password = hash;
            next();
        });
    });
});

AdminSchema.methods.comparePassword = function (candidatePassword) {
    return new Promise((resolve, reject) => {
        bcrypt.compare(candidatePassword, this.password).then((data) => {
            return resolve(data);
        });
    });
};

module.exports = mongoose.model('Admin', AdminSchema);
