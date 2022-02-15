const util = require('util');
const multer = require('multer');
const consts = require('../utils/consts')

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // cb(null, process.cwd() + '/uploads/collections');
        cb(null, 'uploads/collections');
    },
    filename: (req, file, cb) => {
        var uniqueSuffix = Date.now() + '-';
        cb(null, uniqueSuffix + file.originalname);
    },
});

// // let uploadFile = multer({
// //     storage: storage,
// // }).single('file');
// let uploadFile = multer({
//     storage: storage,
// }).fields([{name: 'file'}, {name: 'thumbnail'}]);
let uploadFile = multer({
    storage: storage,
}).single('image');

let uploadFileMiddleware = util.promisify(uploadFile);

// module.exports = uploadFileMiddleware;
module.exports = uploadFile;