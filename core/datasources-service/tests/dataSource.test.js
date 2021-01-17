const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const sinon = require('sinon');
const { request } = require('./request');
const dbConnection = require('../lib/db');
const {
    createDataSource,
    fetchDataSource,
    deleteDataSource,
    updateVersion,
    nonExistingId,
    fetchDataSourceVersions,
} = require('./utils');

let DATASOURCE_GIT_REPOS_DIR, restUrl, restPath;

describe('Datasource', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        STORAGE_DIR = global.testParams.STORAGE_DIR;
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
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
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
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
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
                HttpStatus.INTERNAL_SERVER_ERROR
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
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
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
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
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
            expect(fileTypes).to.have.lengthOf([...new Set(fileTypes)].length);
        });
    });
    describe('datasource/:name DELETE', () => {
        it('should throw not found on delete by name', async () => {
            const name = uuid();
            const delRes = await deleteDataSource({ name });
            expect(delRes.body).to.have.property('error');
            expect(delRes.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(delRes.body.error.message).to.match(/Not Found/i);
        });
        it('should create and delete one datasource by name', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const fetchRes = await fetchDataSource({ name });
            const delRes = await deleteDataSource({ name });
            const fetchDel = await fetchDataSource({ name });
            expect(fetchRes.body.name).to.eql(name);
            expect(delRes.body).to.eql({ deleted: 1 });
            expect(fetchDel.body).to.have.property('error');
            expect(fetchDel.body.error.code).to.equal(HttpStatus.NOT_FOUND);
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
            expect(fetchDel.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(fetchDel.body.error.message).to.match(/Not Found/i);
        });
    });
    describe('/datasource/:name/versions GET', () => {
        it('should fetch the versions listing of a datasource', async () => {
            const name = uuid();
            const { body: dataSource } = await createDataSource({
                body: { name },
            });
            const [existingFile] = dataSource.files;
            expect(
                await fse.pathExists(
                    `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`
                )
            ).to.be.true;
            expect(
                await fse.statSync(
                    `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`
                ).size
            ).to.eq(107);
            const uploadResponse = await updateVersion({
                dataSourceName: name,
                fileNames: ['updatedVersions/README-1.md'],
                mapping: [existingFile],
            });
            const { body: versionsList } = await fetchDataSourceVersions({
                name,
            });
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
