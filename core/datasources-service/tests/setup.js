const fse = require('fs-extra');
const sinon = require('sinon');
const storageManager = require('@hkube/storage-manager');
const DATASOURCE_GIT_REPOS_DIR = 'temp/git-repositories';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const pathLib = require('path');
const {
    setupGithubToken,
    removeGithubToken,
    getGitlabToken,
} = require('./gitToken');
const { STORAGE_DIR } = require('./utils');
const { removeAllRepos } = require('./clearGitlab');
const { Gitlab } = require('@gitbeaker/node');
const { getDatasourcesInUseFolder } = require('./../lib/utils/pathUtils');
let githubToken = null;
let gitlabToken = null;
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

    githubToken = await setupGithubToken(config.git.github);
    const githubTokenHash = githubToken.sha1;
    gitlabToken = getGitlabToken(config.git.gitlab);

    // @ts-ignore
    global.testParams = {
        restUrl,
        internalUrl,
        config,
        DATASOURCE_GIT_REPOS_DIR,
        STORAGE_DIR,
        mountedDir: getDatasourcesInUseFolder(config),
        storage: config.s3,
        git: {
            ...config.git,
            github: {
                ...config.git.github,
                token: githubTokenHash,
            },
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
    // --- on local tests clear the git server --- //
    // removeGithubToken(gitConfig, githubToken);
    // await removeAllRepos(gitConfig.gitlab);
});
