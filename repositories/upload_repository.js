const util = require('util');
const multer = require('multer');
const consts = require('../utils/consts')

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // cb(null, process.cwd() + '/uploads/' + consts.NFT_CONTRACT_ADDR);
        cb(null, 'uploads/nfts');
    },
    filename: (req, file, cb) => {
        var uniqueSuffix = Date.now() + '-';
        cb(null, uniqueSuffix + file.originalname);
    },
});

// let uploadFile = multer({
//     storage: storage,
// }).single('file');
let uploadFile = multer({
    storage: storage,
}).fields([{name: 'file'}, {name: 'thumbnail'}]);

let uploadFileMiddleware = util.promisify(uploadFile);

// module.exports = uploadFileMiddleware;
module.exports = uploadFile;