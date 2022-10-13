const util = require('util');
const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // cb(null, process.cwd() + '/uploads/collections');
        const path = 'uploads/collections';
        fs.mkdirSync(path, { recursive: true });
        cb(null, path);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-';
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
}).fields([{name: 'image'}, {name: 'logo'}, {name: 'optional_images'}]);

let uploadFileMiddleware = util.promisify(uploadFile);

// module.exports = uploadFileMiddleware;
module.exports = uploadFile;