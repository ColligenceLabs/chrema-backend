const util = require('util');
const multer = require('multer');

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.cwd() + '/uploads/company');
    },
    filename: (req, file, cb) => {
        var uniqueSuffix = Date.now() + '-';
        cb(null, uniqueSuffix + file.originalname);
    },
});
let uploadFile = multer({
    storage: storage,
}).single('file');

let uploadFileMiddleware = util.promisify(uploadFile);

module.exports = uploadFileMiddleware;
