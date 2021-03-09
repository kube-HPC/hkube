const fse = require('fs-extra');
const sinon = require('sinon');
const storageManager = require('@hkube/storage-manager');
const DATASOURCE_GIT_REPOS_DIR = 'temp/git-repositories';
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
const { setupGithubToken } = require('./gitToken');
const { STORAGE_DIR } = require('./utils');
const { getDatasourcesInUseFolder } = require('./../lib/utils/pathUtils');
let githubToken = null;

before(async function () {
    this.timeout(15000);
    const bootstrap = require('../bootstrap');
    /** @type {import('./../lib/utils/types').config} */
    const config = await bootstrap.init();
    const storage = new storageManager.StorageManager();
    await storage.init({ ...config }, null, true);
    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}/v1`;
    const internalUrl = `${baseUrl}/internal/v1`;

    githubToken = await setupGithubToken(config.git.github);
    const githubTokenHash = githubToken.sha1;

    const { git, _git } = (() => {
        const { github, gitlab } = config.git;
        const { endpoint: githubEndpoint, user, ...githubRest } = github;
        const { endpoint: gitlabEndpoint, ...gitlabRest } = gitlab;
        return {
            _git: {
                github: { user, endpoint: githubEndpoint },
                gitlab: { endpoint: gitlabEndpoint },
            },
            git: {
                github: { ...githubRest, token: githubTokenHash },
                gitlab: gitlabRest,
            },
        };
    })();

    // @ts-ignore
    global.testParams = {
        restUrl,
        internalUrl,
        config,
        DATASOURCE_GIT_REPOS_DIR,
        STORAGE_DIR,
        mountedDir: getDatasourcesInUseFolder(config),
        storage: config.s3,
        gitEndpoint: {
            github: config.git.github.endpoint,
            gitlab: config.git.gitlab.endpoint,
        },
        _git,
        git,
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
