const {body, param, query} = require('express-validator');

module.exports = {
    classname: 'ValidateProfile',

    login: () => {
        return [
            param('id').not().isEmpty().withMessage('Missing address parameter'),
            query('chainId').not().isEmpty().withMessage('Missing chain id parameter')
        ];
    },
    update: () => {
        return [
            body('id').not().isEmpty().withMessage('Missing profile id parameter'),
        ]
    },
};