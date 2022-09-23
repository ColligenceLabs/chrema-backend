const request = require('request');
const fs = require('fs');
const projectId = process.env.INFURA_IPFS_PROJECT_ID;
const projectSecret = process.env.INFURA_IPFS_PROJECT_SECRET;

function getAuth() {
  return 'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64');
}

async function requestIPFS(options) {
  return await new Promise(function (resolve, reject) {
    request(options, async function (error, response) {
      if (!error && response.statusCode == 200) {
        // console.log("add json to ipfs success")
        resolve(response.body);
      } else {
        reject(error);
      }
    });
  });
}

module.exports = {
  addFile: async function (path, name) {
    console.log('start file upload to ipfs...', path, name);
    const auth = getAuth();
    const options = {
      method: 'POST',
      url: 'https://ipfs.infura.io:5001/api/v0/add',
      headers: {
        Authorization: auth,
      },
      formData: {
        file: {
          value: fs.createReadStream(path),
          options: {
            filename: name,
            contentType: null,
          },
        },
      },
    };

    const getResponse = await requestIPFS(options);
    return JSON.parse(getResponse);
  },
  addJson: async function (metadata) {
    // console.log("start json upload to ipfs...")
    const auth = getAuth();
    const options = {
      method: 'POST',
      url: 'https://ipfs.infura.io:5001/api/v0/add',
      headers: {
        Authorization: auth,
      },
      formData: {
        file: JSON.stringify(metadata),
      },
    };
    const getResponse = await requestIPFS(options);
    return JSON.parse(getResponse);
  },
};
