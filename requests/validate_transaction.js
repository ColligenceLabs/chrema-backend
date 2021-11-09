var {body, param} = require('express-validator');

module.exports = {
    classname: 'ValidateAdmin',

    update: () => {
        return [param('id').not().isEmpty().withMessage('Missing id parameter')];
    },
};
