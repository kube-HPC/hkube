const { expect } = require('chai');
const fse = require('fs-extra');
const { StatusCodes } = require('http-status-codes');
const { Octokit } = require('@octokit/rest');
const { Gitlab: GitlabClient } = require('@gitbeaker/node');
const sinon = require('sinon');
const { uid: uuid } = require('@hkube/uid');
const { request } = require('./request');
const dedicatedStorage = require('./../lib/DedicatedStorage');
const dbConnection = require('../lib/db');
const { nonExistingId, mockDeleteClone } = require('./utils');
const {
    createDataSource,
    fetchDataSource,
    deleteDataSource,
    updateVersion,
    fetchDataSourceVersions,
} = require('./api');

let DATASOURCE_GIT_REPOS_DIR, restUrl, restPath;

const fetchGithubRepo = async name => {
    // @ts-ignore
    const { github } = global.testParams.git;
    const client = new Octokit({
        baseUrl: `${github.endpoint}/api/v1`,
        auth: github.token,
    });
    return client.repos.get({
        repo: name,
        owner: github.user.name,
    });
};

/** @returns {Promise<any>} */
const fetchGitlabRepo = async repositoryUrl => {
    // @ts-ignore
    const { gitlab } = global.testParams.git;
    const client = new GitlabClient({
        host: gitlab.endpoint,
        token: gitlab.token,
        tokenName: gitlab.tokenName,
    });
    const url = new URL(repositoryUrl).pathname
        .replace(/^\//, '')
        .replace('.git', '');
    return client.Projects.show(url);
};

const listDvcRepository = async name => dedicatedStorage.list({ path: name });

describe('Datasource', () => {
    before(() => {
        // @ts-ignore
        restUrl = global.testParams.restUrl;
        // @ts-ignore
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        restPath = `${restUrl}/datasource`;
    });
    describe('datasource/id/:id GET', () => {
        it('should fetch by id', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({
                body: { name },
            });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await updateVersion({
                dataSourceName: name,
                fileNames: [secondFileName],
            });
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(uploadResponse.statusCode).to.eql(StatusCodes.CREATED);
            const { body: oldVersion } = await fetchDataSource({
                id: firstVersion.id,
            });
            expect(oldVersion.id).to.eq(firstVersion.id);
        });
    });
    describe('/datasource/:name GET', () => {
        it('should throw error datasource not found', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}`,
                method: 'GET',
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.match(/Not Found/i);
        });
        it('should fail fetching dataSource', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}`,
                method: 'GET',
            };
            sinon
                .stub(dbConnection.connection.dataSources, 'fetch')
                .rejects({ message: 'i should throw' });
            const response = await request(options);
            sinon.restore();
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(
                StatusCodes.INTERNAL_SERVER_ERROR
            );
            expect(response.body.error.message).to.eq('i should throw');
        });
        it('should fetch a datasource', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const { response: getResponse } = await fetchDataSource({
                name,
            });
            const { body: dataSource } = getResponse;
            expect(dataSource).to.have.property('id');
            expect(dataSource.id).to.be.string;
            expect(dataSource).to.have.property('name');
            expect(dataSource.name).to.eq(name);
            expect(dataSource).to.have.property('files');
            const [file] = dataSource.files;
            expect(file).to.have.property('id');
            expect(file).to.have.property('name');
            expect(file).to.have.property('path');
            expect(file).to.have.property('size');
            expect(file).to.have.property('type');
        });
        it('should fetch an older version', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({
                body: { name },
            });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await updateVersion({
                dataSourceName: name,
                fileNames: [secondFileName],
            });
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(uploadResponse.statusCode).to.eql(StatusCodes.CREATED);
            const { body: oldVersion } = await fetchDataSource({
                name,
                id: firstVersion.id,
            });
            expect(oldVersion.id).to.eq(firstVersion.id);
        });
        it('should fail if id does not match the name', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({
                body: { name },
            });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await updateVersion({
                dataSourceName: name,
                fileNames: [secondFileName],
            });
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(uploadResponse.statusCode).to.eql(StatusCodes.CREATED);
            const { body: errorBody } = await fetchDataSource({
                name: 'not real name',
                id: firstVersion.id,
            });
            expect(errorBody).to.have.property('error');
            expect(errorBody.error.code).to.eq(400);
            expect(errorBody.error.message).to.match(
                /id (.+) does not exist for name (.+)/i
            );
        });
    });
    describe('/datasource GET', () => {
        it('should succeed list all dataSources', async () => {
            const names = new Array(3).fill(0).map(() => uuid());
            await Promise.all(
                names.map(name => createDataSource({ body: { name } }))
            );
            const options = {
                uri: restPath,
                method: 'GET',
            };
            const response = await request(options);
            expect(response.body).to.be.an('array');
            response.body.forEach(entry => {
                expect(entry).to.have.property('id');
                expect(entry).to.have.property('name');
                expect(entry).not.to.have.property('files');
            });
            const fetchedNames = response.body.map(item => item.name);
            names.forEach(name => expect(fetchedNames).to.contain(name));
        });
        it('should return only unique file types', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const fileNames = ['README-2.md', 'algorithms.json'];
            await updateVersion({ dataSourceName: name, fileNames });
            const options = {
                uri: restPath,
                method: 'GET',
            };
            const { body } = await request(options);
            const ds = body.find(item => item.name === name);
            const { fileTypes } = ds;
            expect(fileTypes).to.have.members([
                'text/markdown',
                'application/json',
            ]);
            // @ts-ignore
            expect(fileTypes).to.have.lengthOf([...new Set(fileTypes)].length);
        });
    });
    describe('datasource/:name DELETE', () => {
        it('should throw not found on delete by name', async () => {
            const name = uuid();
            const delRes = await deleteDataSource({ name });
            expect(delRes.body).to.have.property('error');
            expect(delRes.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(delRes.body.error.message).to.match(/Not Found/i);
        });
        it('should create and delete one datasource by name - github', async () => {
            const name = uuid();

            await createDataSource({ body: { name } });
            const fetchRes = await fetchDataSource({ name });
            const checkExist = await fetchGithubRepo(name);
            expect(checkExist.status).to.eq(StatusCodes.OK);
            const dvcFiles = await listDvcRepository(name);
            expect(dvcFiles).to.have.lengthOf(1);
            const delRes = await deleteDataSource({ name });
            const dvcFilesAfterDelete = await listDvcRepository(name);
            expect(dvcFilesAfterDelete).to.have.lengthOf(0);
            await expect(fetchGithubRepo(name)).to.eventually.be.rejected;
            const fetchDel = await fetchDataSource({ name });
            expect(fetchRes.body.name).to.eql(name);
            expect(delRes.body).to.eql({ deleted: 1 });
            expect(fetchDel.body).to.have.property('error');
            expect(fetchDel.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(fetchDel.body.error.message).to.match(/Not Found/i);
        });

        it.skip('should create and delete one datasource by name - gitlab', async () => {
            const name = uuid();
            await createDataSource({ body: { name }, useGitlab: true });
            const fetchRes = await fetchDataSource({ name });
            const { repositoryUrl } = fetchRes.body;
            const dvcFiles = await listDvcRepository(name);
            expect(dvcFiles).to.have.lengthOf(1);
            const checkExist = await fetchGitlabRepo(repositoryUrl);
            expect(checkExist.name).to.eq(name);
            const delRes = await deleteDataSource({ name });
            const dvcFilesAfterDelete = await listDvcRepository(name);
            expect(dvcFilesAfterDelete).to.have.lengthOf(0);
            await expect(fetchGitlabRepo(repositoryUrl)).to.eventually.be
                .rejected;
            const fetchDel = await fetchDataSource({ name });
            expect(fetchRes.body.name).to.eql(name);
            expect(delRes.body).to.eql({ deleted: 1 });
            expect(fetchDel.body).to.have.property('error');
            expect(fetchDel.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(fetchDel.body.error.message).to.match(/Not Found/i);
        });
        it('should create and delete multiple versions of a datasource by name', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const secondFileName = 'README-2.md';
            await updateVersion({
                dataSourceName: name,
                fileNames: [secondFileName],
            });
            const fetchRes = await fetchDataSource({ name });
            const delRes = await deleteDataSource({ name });
            const fetchDel = await fetchDataSource({ name });

            expect(fetchRes.body.name).to.eql(name);
            expect(fetchRes.body.files).to.have.lengthOf(2);
            expect(delRes.body).to.eql({ deleted: 2 });
            expect(fetchDel.body).to.have.property('error');
            expect(fetchDel.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(fetchDel.body.error.message).to.match(/Not Found/i);
        });
    });
    describe('/datasource/:name/versions GET', () => {
        it('should fetch the versions listing of a datasource', async () => {
            const name = uuid();
            const deleteClone = mockDeleteClone();
            const { body: dataSource } = await createDataSource({
                body: { name },
            });
            expect(deleteClone.callCount).to.eq(1);
            const [existingFile] = dataSource.files;
            expect(
                await fse.pathExists(
                    `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`
                )
            ).to.be.true;
            const fileStats = await fse.stat(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`
            );
            expect(fileStats.size).to.eq(107);
            const uploadResponse = await updateVersion({
                dataSourceName: name,
                fileNames: ['updatedVersions/README-1.md'],
                mapping: [existingFile],
            });
            const { body: versionsList } = await fetchDataSourceVersions({
                name,
            });
            expect(deleteClone.callCount).to.eq(2);
            expect(versionsList).to.have.lengthOf(2);
            // validates the order of the array
            const [, latestVersion] = versionsList;
            expect(uploadResponse.body.id).to.eq(latestVersion.id);
        });
        it('should fetch the versions listing for non existing datasource', async () => {
            const { body: versionsList } = await fetchDataSourceVersions({
                name: 'not-existing-dataasource',
            });
            expect(versionsList).to.have.length(0);
        });
    });
});
