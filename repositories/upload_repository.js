const util = require('util');
const multer = require('multer');
const fs = require('fs');

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // cb(null, process.cwd() + '/uploads/' + consts.NFT_CONTRACT_ADDR);
        const path = 'uploads/nfts';
        fs.mkdirSync(path, { recursive: true });
        cb(null, path);
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
}).fields([{name: 'file'}, {name: 'thumbnail'}, {name: 'album_jacket'}]);

let uploadFileMiddleware = util.promisify(uploadFile);

// module.exports = uploadFileMiddleware;
module.exports = uploadFile;