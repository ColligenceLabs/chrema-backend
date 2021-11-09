var {body, param} = require('express-validator');
const {AdminModel} = require('../models');
const ErrorMessage = require('../utils/errorMessage').ErrorMessage;
const {checkObjectId} = require('../utils/helper');
var ObjectID = require('mongodb').ObjectID;

module.exports = {
    classname: 'ValidateAdmin',

    register: () => {
        return [
            body('full_name').not().isEmpty().withMessage('Missing full_name parameter').trim(),
            body('email', 'Missing email parameter')
                .isLength({min: 1})
                .trim()
                .custom((value) => {
                    return AdminModel.findOne({email: value}).then((admin) => {
                        if (admin) {
                            return Promise.reject('Email already exist!');
                        }
                    });
                }),
            body('password', 'Password length should be 5 to 30 characters!')
                .isLength({min: 5, max: 30})
                .trim(),
        ];
    },

    login: () => {
        return [
            body('email', 'Missing email parameter')
                .isLength({min: 1})
                .trim()
                .custom(async(value) => {
                    let admins = await AdminModel.find().sort({createdAt: -1, _id: 1});
                    console.log("admins::::",admins);
                    return AdminModel.findOne({email: value}).then((admin) => {
                        if (!admin) {
                            return Promise.reject(ErrorMessage.ACCOUNT_IS_NOT_FOUND);
                        }
                    });
                }),
            body('password', 'Password length should be 5 to 30 characters!')
                .isLength({min: 5, max: 30})
                .trim(),
        ];
    },
};
