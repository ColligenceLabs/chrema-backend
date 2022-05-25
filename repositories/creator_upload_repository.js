const util = require('util');
const multer = require('multer');
const fs = require('fs');

var storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // cb(null, process.cwd() + '/uploads/creators');
        const path = 'uploads/creators';
        fs.mkdirSync(path, { recursive: true });
        cb(null, path);
    },
    filename: (req, file, cb) => {
        var uniqueSuffix = Date.now() + '-';
        cb(null, uniqueSuffix + file.originalname);
    },
});

let uploadFile = multer({
    storage: storage,
}).single('image');

let creatorUploadFileMiddleware = util.promisify(uploadFile);

// module.exports = creatorUploadFileMiddleware;
module.exports = uploadFile;
