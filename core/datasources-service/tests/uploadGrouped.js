const pathLib = require('path');
const { createDataSource } = require('./api');
const fse = require('fs-extra');

const uploadGrouped = async name => {
    const fileNames = await fse.readdir(
        pathLib.resolve(__dirname, 'mocks', 'grouped-meta')
    );
    const filePaths = fileNames.map(name => pathLib.join('grouped-meta', name));
    return createDataSource(name, {
        fileNames: filePaths,
    });
};

const splitArr = collection => {
    const { length } = collection;
    const idx = length / 2;
    return [collection.slice(0, idx), collection.slice(idx, length)];
};

module.exports = {
    uploadGrouped,
    splitArr,
};
