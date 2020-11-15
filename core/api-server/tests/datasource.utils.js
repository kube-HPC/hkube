const fse = require('fs-extra');
const { request } = require('./utils');

// a valid mongo ObjectID;
const nonExistingId = '5f953d50dd38c8291924a0a3';
const fileName = 'README-1.md';

/** @type {(props?: { body?: { name?:string }, withFile?:boolean, fileNames?: string[] }) => Promise<any>} */
const createDataSource = ({
    body = {},
    withFile = true,
    fileNames = [fileName],
} = {}) => {
    const uri = `${global.testParams.restUrl}/datasource`
    const formData = {
        ...body,
        files: withFile ? fileNames.map(name => fse.createReadStream(`tests/mocks/${name}`)) : undefined
    };
    const options = {
        uri,
        formData
    };
    return request(options);
};

/**
 * @param {string} dataSourceName
 * @param {string} uri
 * @param {string[]} fileNames
 */
const uploadFile = (dataSourceName, fileNames = [], versionDescription = 'new-version') => {
    const uri = `${global.testParams.restUrl}/datasource`;
    const formData = fileNames.length > 0 ? {
        versionDescription,
        filesAdded: fileNames.length > 0 ? fileNames.map(fileName => fse.createReadStream(`tests/mocks/${fileName}`)) : undefined
    } : { versionDescription };
    const options = {
        uri: `${uri}/${dataSourceName}`,
        formData
    };
    return request(options);
};

/** 
 * @param {object} query 
 * @param {string} query.name 
 * */
const fetchDataSource = ({ name }) => {
    const uri = `${global.testParams.restUrl}/datasource`;
    const getOptions = {
        uri: `${uri}/${name}`,
        method: 'GET'
    };
    return request(getOptions);
};

module.exports = {
    fetchDataSource, createDataSource, uploadFile, nonExistingId, fileName
}
