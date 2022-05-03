const mongoose = require('mongoose');
var ObjectId = mongoose.Types.ObjectId;
const {validationResult} = require('express-validator');
const moment = require('moment-timezone');
var consts = require('./consts');
var sharp = require('sharp');
const axios = require('axios');
const BigNumber = require('bignumber.js');
var fs = require('fs');
var fsx = require('fs-extra')

const TIMEZONE = process.env.TIMEZONE;
exports._errorFormatter = (errors) => {
    let res = [];

    for (let i = 0; i < errors.length; i++) {
        res.push(errors[i].msg);
    }

    return res.join('. ');
};

exports.checkObjectId = (id) => {
    return ObjectId.isValid(id);
};

exports.calcQuantitySellingNumber = (serials) => {
    let quantity = 0;

    for (let j = 0; j < serials.length; j++) {
        if (
            // TODO : ADMIN_ADDRESS 부분 점검 필요
            (serials[j].owner_id === null || serials[j].owner_id.address === consts.ADMIN_ADDRESS) &&
            serials[j].status === 'active'
        ) {
            quantity += 1;
        }
    }

    return quantity;
};

exports.checkTimeCurrent = (start_time, current, end_time) => {
    if (new Date(start_time) <= current && new Date(end_time) >= current) {
        return true;
    }
    return false;
};

exports.getHeaders = (totalCount, page, perPage) => {
    page = +page;
    perPage = +perPage;
    let pagesCount = Math.ceil(totalCount / perPage);

    return {
        'x_page': page,
        'x_total_count': totalCount,
        'x_pages_count': pagesCount,
        'x_per_page': perPage,
        'x_next_page': page === pagesCount ? page : page + 1,
    };
};

exports.addMongooseParam = (mongooseObject = {}, key, value) => {
    if (!mongooseObject) {
        mongooseObject = {};
    }

    mongooseObject[key] = value;

    return mongooseObject;
};

exports.isEmptyObject = (value) => {
    return Object.keys(value).length === 0 && value.constructor === Object;
};

exports.getValueInEnum = (obj) => {
    const arrayVal = [];
    for (const property in obj) {
        arrayVal.push(`${obj[property]}`);
    }
    return arrayVal;
};

exports.getCollectionCateValueInEnum = (obj) => {
    const arrayVal = [];
    for (const property in obj) {
        arrayVal.push(`${obj[property]['value']}`);
    }
    return arrayVal;
};

exports.validateRouter = (req, res) => {
    let errorMsg = undefined;
    var errors = validationResult(req);
    if (!errors.isEmpty()) {
        errorMsg = this._errorFormatter(errors.array());
    }
    return errorMsg;
};

exports.checkExistedDocument = async (repo, ids) => {
    const docs = await repo.findAllWithArrayIds(ids);
    const errorIds = [];
    const existIds = [];

    docs.forEach((element) => {
        existIds.push(element.id);
    });

    for (let i = 0; i < ids.length; i++) {
        if (existIds.includes(ids[i]) === false) {
            errorIds.push(ids[i]);
        }
    }

    return errorIds;
};

exports.convertTimezone = (time, timezone = TIMEZONE) => {
    const format = 'YYYY-MM-DDThh:mm:ssTZD';
    const convertTime = moment.tz(time, format, timezone);

    return new Date(convertTime);
};

exports.imageResize = async (imgInput, imgOutput) => {
    sharp(imgInput).resize({ width: 500 }).toFile(imgOutput)
        .then(function(newFileInfo) {
            // 2021.11.15 don't delete original image
            // delete original image
            // fs.unlinkSync(imgInput);
            console.log("resize Success")
        })
        .catch(function(err) {
            // rename image when resize fails
            console.log("Error occured", err);
        });
};

exports.imageRename = async (imgInput, renameOutput) => {
    fs.rename(imgInput, renameOutput, (err) => {

        if (err) {
            console.log("error:", err);
        } else {
            console.log("rename success");
        }
    })
}

exports.getCoinPrice = async () => {
    const url = 'https://bcn-api.talken.io/coinmarketcap/cmcQuotes?cmcIds=4256,11552';
    try {
        const response = await axios(url);
        const klayUsd = response.data.data[4256].quote.USD.price;
        const klayKrw = response.data.data[4256].quote.KRW.price;
        const talkUsd = response.data.data[11552].quote.USD.price;
        const talkKrw = response.data.data[11552].quote.KRW.price;
        const result = {klay: {USD: klayUsd, KRW: klayKrw},talk: {USD: talkUsd, KRW: talkKrw}};

        return result;
    } catch (error) {
        console.log(new Error(error));
        return error;
    }
}

exports.imageMove = async (imgInput, renameOutput) => {
    fsx.move(imgInput, renameOutput, { overwrite: true }, (err) => {

        if (err) {
            console.log("error:", err);
        } else {
            console.log("move success");
        }
    })
}

exports.writeJson = async(linkHash,data, num) => {
    fs.writeFile(linkHash , data, (err) => {

        if (err) {
            // res.status(500).send(err.stack);
            console.log("error : ", err);
        } else {
            console.log(`write json file success ... #${num}`);
        }
     });
};

exports.getFloorPrice = (filteredPrices, coinPrices) => {
    let floorPrice;
    if (filteredPrices.length === 1) {
        floorPrice = filteredPrices[0];
    } else {
        const price1 = new BigNumber(filteredPrices[0].floorPrice).multipliedBy(coinPrices[filteredPrices[0]._id].USD).toNumber();
        const price2 = new BigNumber(filteredPrices[1].floorPrice).multipliedBy(coinPrices[filteredPrices[1]._id].USD).toNumber();
        floorPrice = price1 > price2 ? filteredPrices[1] : filteredPrices[0];
    }
    return floorPrice;
};
