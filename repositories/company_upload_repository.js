const util = require('util');
const multer = require('multer');
const consts = require('../utils/consts');

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, process.cwd() + '/uploads/' + consts.NFT_CONTRACT_ADDR + '/company');
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
