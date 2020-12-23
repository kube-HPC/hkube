const fse = require('fs-extra');
const sinon = require('sinon');
const DATASOURCE_GIT_REPOS_DIR = 'temp/datasource-git-repositories';
const STORAGE_DIR = '/var/tmp/fs/storage/local-hkube-dvc';

before(async function () {
    this.timeout(15000);
    const bootstrap = require('../bootstrap');
    const config = await bootstrap.init();
    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;
    global.testParams = {
        restUrl,
        internalUrl,
        config,
        DATASOURCE_GIT_REPOS_DIR: 'temp/datasource-git-repositories',
        STORAGE_DIR: '/var/tmp/fs/storage/local-hkube-dvc',
    };
    // avoid actually deleting files for testing changes on the fs
    sinon.stub(fse, 'remove');
});

afterEach(() => {
    sinon.reset();
});

after(() => {
    // fse.removeSync(DATASOURCE_GIT_REPOS_DIR);
    // fse.removeSync(STORAGE_DIR);
});
