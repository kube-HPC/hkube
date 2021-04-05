const fse = require('fs-extra');
const sinon = require('sinon');
const Repository = require('./../lib/utils/Repository');
const { Gitlab, Github } = require('../lib/utils/GitRemoteClient');
// a valid mongo ObjectID;
const nonExistingId = '5f953d50dd38c8291924a0a3';
const fileName = 'README-1.md';
const STORAGE_DIR = '/var/tmp/fs/storage/local-hkube-datasource';
const delay = d => new Promise(r => setTimeout(r, d));

const mockRemove = () => {
    const mock = sinon.fake.resolves('The remove method is mocked!');
    sinon.replace(fse, 'remove', mock);
    return mock;
};
const mockDeleteClone = () => {
    const mock = sinon.fake.resolves('The method is mocked!');
    sinon.replace(Repository.prototype, 'deleteClone', mock);
    return mock;
};

/**
 * @param {import('../lib/utils/types').githubConfig} config
 * @returns {Promise<string>}
 */
const createRepository = async (config, name) => {
    const { kind = 'github' } = config;
    let client;
    if (kind === 'github') {
        client = new Github(config, null, '');
    } else {
        client = new Gitlab(config, null, '');
    }
    return client.createRepository(name);
};


// a list of properties that should not be returned to the client
const hiddenProperties = ['_id', '_credentials', 'isPartial'];

module.exports = {
    delay,
    nonExistingId,
    fileName,
    mockRemove,
    hiddenProperties,
    mockDeleteClone,
    STORAGE_DIR,
    createRepository,

};
