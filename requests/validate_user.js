var {body, query, validationResult, param} = require('express-validator');

module.exports = {
    classname: 'ValidateUser',

    deleteUser: () => {
        return [
            body('user_name').not().isEmpty().withMessage('Missing user_name parameter'),
            body('email').not().isEmpty().withMessage('Missing email parameter'),
        ];
    },
};
