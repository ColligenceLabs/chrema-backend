const multer = require('multer');
const fs = require('fs');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const path = 'uploads/profiles';
        fs.mkdirSync(path, { recursive: true });
        cb(null, path);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-';
        cb(null, uniqueSuffix + file.originalname);
    },
});

let uploadFile = multer({
    storage: storage,
}).fields([{name: 'image'}, {name: 'banner'}]);

module.exports = uploadFile;