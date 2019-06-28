'use strict'
const config = require('./common.js');
const AWS = require('aws-sdk');
const credentials = new AWS.Credentials({
    accessKeyId: process.env.INVENTORY_ACCESS_KEY_ID || config.s3AccessKeyId,
    secretAccessKey: process.env.INVENTORY_SECRET_ACCESS_KEY || config.s3SecretAccessKey
});
AWS.config.credentials = credentials;
const s3 = new AWS.S3({apiVersion: '2006-03-01'});
const bucket = process.env.INVENTORY_S3BUCKET || config.s3Bucket;

async function getData(key) {
    //console.log('~~~ getCurveDataFromS3: '+ bucket + '/' + key);
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

