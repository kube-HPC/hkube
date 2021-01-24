const fse = require('fs-extra');
const sinon = require('sinon');
const DATASOURCE_GIT_REPOS_DIR = 'temp/git-repositories';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const STORAGE_DIR = '/var/tmp/fs/storage/local-hkube-datasource';

before(async function () {
    this.timeout(15000);
    const bootstrap = require('../bootstrap');
    /** @type {import('./../lib/utils/types').config} */
    const config = await bootstrap.init();
    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;
    const {
        user: { name: userName, password },
        endpoint,
    } = config.git;
    global.testParams = {
        restUrl,
        internalUrl,
        config,
        DATASOURCE_GIT_REPOS_DIR,
        STORAGE_DIR,
        directories: config.directories,
        gitUrl: `http://${userName}:${password}@${endpoint}/api/v1/repos/hkube`,
    };
});

afterEach(() => {
    sinon.restore();
});

after(() => {
    fse.removeSync('temp/');
    fse.removeSync('uploads/');
    fse.removeSync(STORAGE_DIR);
});
