const { expect } = require('chai');
const fse = require('fs-extra');
const { uid: uuid } = require('@hkube/uid');

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
            return { name, response };
        };
        it('should ensure the root dir exists', async () => {
            expect(await fse.pathExists(DATASOURCE_GIT_REPOS_DIR)).to.be.true;
        });
        it('should create a new git repo and create a data directory', async () => {
            const { name, response } = await createRepository();
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
