'use strict'
const AWS = require('aws-sdk');
const credentials = new AWS.SharedIniFileCredentials({profile: 'wi_inventory'});
AWS.config.credentials = credentials;
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const bucket = "wi-inventory";

async function getData(key) {
    console.log('~~~ getCurveDataFromS3: ' + key);
    let params = {
        Bucket: bucket,
        Key: key
    }
    return new Promise((resolve, reject) => {
        s3.headObject(params, (err, data) => {
            if(err) {
                console.log("S3 getdata err: " + err);
                reject(err);
            }
            else resolve(s3.getObject(params).createReadStream());
        })
    })
}

module.exports = {
    getData: getData
}

