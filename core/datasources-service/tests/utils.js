const fse = require('fs-extra');
const sinon = require('sinon');
const Repository = require('./../lib/utils/Repository');

// a valid mongo ObjectID;
const nonExistingId = '5f953d50dd38c8291924a0a3';
const fileName = 'README-1.md';

const delay = d => new Promise(r => setTimeout(r, d));

const mockRemove = () => {
    const mock = sinon.fake.resolves('The remove method is mocked!');
    sinon.replace(fse, 'remove', mock);
    return mock;
};
const mockDeleteClone = () => {
    // const x = new Repository();
    // x.deleteClone
    const mock = sinon.fake.resolves('The method is mocked!');
    sinon.replace(Repository.prototype, 'deleteClone', mock);
    return mock;
};

module.exports = {
    delay,
    nonExistingId,
    fileName,
    mockRemove,
    mockDeleteClone,
};
