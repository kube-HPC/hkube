const { expect } = require('chai');
const fse = require('fs-extra');
// const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
// const sinon = require('sinon');
// const stateManager = require('../lib/state/state-manager');
// const validationMessages = require('../lib/consts/validationMessages.js');
// const { request } = require('./utils');
// const dbConnection = require('../lib/db');
// const storage = require('@hkube/storage-manager');
// let restUrl, restPath;
// const {
//     createDataSource,
//     fetchDataSource,
//     uploadFile,
//     fileName,
//     nonExistingId
// } = require('./datasource.utils');
let restUrl, restPath, service;
const DATASOURCE_GIT_REPOS_DIR = 'temp/datasource-git-repositories';

describe('Datasource-service', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/datasource`;
        service = require('./../lib/service/dataSource');
    });
    after(() => {
        fse.removeSync(DATASOURCE_GIT_REPOS_DIR);
    });

    describe('git repository', () => {
        const createRepository = async (name = uuid()) => {
            const response = await service.createRepo(name);
            return { name, response }
        };
        it('should ensure the root dir exists', async () => {
            expect(await fse.pathExists(DATASOURCE_GIT_REPOS_DIR)).to.be.true;
        });
        it('should create a new git repo and create a data directory', async () => {
            const { name, response } = await createRepository()
            const path = `${DATASOURCE_GIT_REPOS_DIR}/${name}`;
            expect(await fse.pathExists(`${path}/.git`)).to.be.true;
            expect(await fse.pathExists(`${path}/data`)).to.be.true;
            expect(await fse.pathExists(`${path}/.dvc`)).to.be.true;
            expect(await fse.pathExists(`${path}/.dvcignore`)).to.be.true;
            expect(response.commit).be.string;
            expect(response.commit).to.have.lengthOf(7);
        });
    });
});
