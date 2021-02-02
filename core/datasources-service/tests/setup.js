const fse = require('fs-extra');
const sinon = require('sinon');
const storageManager = require('@hkube/storage-manager');
const DATASOURCE_GIT_REPOS_DIR = 'temp/git-repositories';
const { setupToken, removeToken } = require('./gitToken');

const STORAGE_DIR = '/var/tmp/fs/storage/local-hkube-datasource';

let token = null;
let gitConfig = null;

before(async function () {
    this.timeout(15000);
    const bootstrap = require('../bootstrap');
    /** @type {import('./../lib/utils/types').config} */
    const config = await bootstrap.init();
    gitConfig = config.git;
    const storage = new storageManager.StorageManager();
    await storage.init({ ...config }, null, true);
    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;
    token = await setupToken(config.git);
    global.testParams = {
        restUrl,
        internalUrl,
        config,
        DATASOURCE_GIT_REPOS_DIR,
        STORAGE_DIR,
        storage: config.s3,
        git: {
            endpoint: gitConfig.endpoint,
            token: token.sha1,
        },
        directories: config.directories,
    };
});

afterEach(() => {
    sinon.restore();
});

after(async () => {
    fse.removeSync('temp/');
    fse.removeSync('uploads/');
    fse.removeSync(STORAGE_DIR);
    return removeToken(gitConfig, token);
});
