const fse = require('fs-extra');
const sinon = require('sinon');
const DATASOURCE_GIT_REPOS_DIR = 'temp/git-repositories';

const STORAGE_DIR = '/var/tmp/fs/storage/local-hkube-datasource';

before(async function () {
    this.timeout(15000);
    const bootstrap = require('../bootstrap');
    /** @type {import('./../lib/utils/types').config} */
    const config = await bootstrap.init();
    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;
    global.testParams = {
        restUrl,
        internalUrl,
        config,
        DATASOURCE_GIT_REPOS_DIR,
        STORAGE_DIR,
        directories: config.directories,
    };
    // avoid actually deleting files for testing changes on the fs
    sinon.stub(fse, 'remove').callsFake((...args) => {
        // console.info(`mocked call to remove with ${args}`);
        return Promise.resolve('The remove method is mocked!');
    });
});

afterEach(() => {
    sinon.reset();
});

after(() => {
    fse.removeSync('temp/');
    fse.removeSync('uploads/');
    fse.removeSync(STORAGE_DIR);
});
