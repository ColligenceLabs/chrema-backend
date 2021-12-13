// for testing
var express = require('express');
var router = express.Router();

// Require controller modules.
var nftController = require('../controllers/blockchain/nft_controller');

// blockchain nft apis
const ipCheck = (req, res, next) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip && ip === "106.243.97.163") next();
    else res.status(401).json({ error: "Auth Error from authcheck" });
};
router.use(ipCheck);

router.get('/list', nftController.tokenList);
router.post('/mint', nftController.mint);
router.post('/burn', nftController.burn);
router.post('/transfer', nftController.transfer);

module.exports = router;
