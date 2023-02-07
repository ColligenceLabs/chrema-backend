const Dao = require('daovault');
const fs = require('fs');

const path = require('path');
const sg = require('nestyle-steganography');

const defExpires = 60 * 60 * 24 * 365; // Default 1 year in seconds

const s3Client = new Dao.Client({
  endPoint: process.env.VAULT_SERV,
  port: 9000,
  accessKey: process.env.VAULT_USER,
  secretKey: process.env.VAULT_PASS,
  useSSL: false, // Default is true.
});

const metaData = {
  'Content-Type': 'image/png',
};

module.exports = {
  createVault: async function (fileName, expires, bucketName) {
    // using putObject
    //
    const filePath = 'uploads/nfts/' + fileName;
    // console.log('===> ', filePath);
    const fileBuffer = fs.readFileSync(filePath);
    // console.log('===> ', fileBuffer);

    // Handle Steganography
    //
    const key = 'abcdefghabcdefghabcdefghabcdefgh'; // Should bew 32 Bytes
    const buffer = sg.write(fileBuffer, 'DAO Vaulted NFT', key);
    // console.log('===> ', buffer);

    const stats = fs.statSync(filePath);

    // Upload onto the distributed storage
    //

    // Bucket Exists Check
    let bucket = 'nfts'; // default bucket 'nfts'
    if (bucketName) {
      const bucketExists = await s3Client.bucketExists(bucketName);
      if (!bucketExists) {
        throw Error('Bucket is not found!');
      }

      bucket = bucketName;
    }

    await s3Client.putObject(bucket, decodeURIComponent(fileName), buffer, stats.size, metaData);

    // TODO : make it selectable between presigned and permanent URL ?
    let url;

    if (expires > 0) {
      // get presignedUrl
      url = await s3Client.presignedGetObject(
        bucket,
        decodeURIComponent(fileName),
        expires ?? defExpires,
      );
      // get permanent ex. http://133.186.211.115:9000/test/test.txt
      // mc policy --recursive links daoserver/test
      // console.log(url);
    } else {
      // get permentUrl
      url = process.env.VAULT_URL + '/' + bucket + '/' + fileName;
    }
    return url;
  },

  getPresignedUrl: async function (fileName, expires, bucketName) {
    // Bucket Exists Check
    let bucket = 'nfts'; // default bucket 'nfts'
    if (bucketName) {
      const bucketExists = await s3Client.bucketExists(bucketName);
      if (!bucketExists) {
        throw Error('Bucket is not found!');
      }

      bucket = bucketName;
    }

    // TODO : make it selectable between presigned and permanent URL ?
    let url;

    if (expires > 0) {
      // get presignedUrl
      url = await s3Client.presignedGetObject(
          bucket,
          decodeURIComponent(fileName),
          expires ?? defExpires,
      );
      // get permanent ex. http://133.186.211.115:9000/test/test.txt
      // mc policy --recursive links daoserver/test
      // console.log(url);
    } else {
      // get permentUrl
      url = process.env.VAULT_URL + '/' + bucket + '/' + fileName;
    }
    return url;
  },
};
