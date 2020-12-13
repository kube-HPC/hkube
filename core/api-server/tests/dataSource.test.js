const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const sinon = require('sinon');
const validationMessages = require('../lib/consts/validationMessages.js');
const { request } = require('./utils');
const dbConnection = require('../lib/db');
const storage = require('@hkube/storage-manager');
let restUrl, restPath;
const {
    createDataSource,
    fetchDataSource,
    updateVersion,
    fileName,
    nonExistingId,
} = require('./datasource.utils');

const DATASOURCE_GIT_REPOS_DIR = 'temp/datasource-git-repositories';
const STORAGE_DIR = '/var/tmp/fs/storage/local-hkube-dvc';

describe('Datasource', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/datasource`;
    });
    after(() => {
        fse.removeSync(DATASOURCE_GIT_REPOS_DIR);
        fse.removeSync(STORAGE_DIR);
    });
    afterEach(() => sinon.restore());
    describe.skip('/datasource/exec/raw', () => {
        it('should throw missing file error', async () => {
            const dataSourceName = uuid();
            const ds = `dataSource.${dataSourceName}/${fileName}`;
            await createDataSource({ body: { name: dataSourceName } });
            const pipeline = {
                name: uuid(),
                nodes: [{
                    nodeName: 'node1',
                    algorithmName: 'green-alg',
                    input: [`@${ds}/non-existing-file.txt`]
                }]
            }
            const res = await request({ uri: `${restUrl}/exec/raw`, body: pipeline });
            const { error } = res.body;
            expect(error).to.haveOwnProperty('message');
            expect(error.message).to.match(/not found/i);
        });
        it('should succeed and return job id', async () => {
            const dataSourceName = uuid();
            const ds = `dataSource.${dataSourceName}/${fileName}`;
            await createDataSource({ body: { name: dataSourceName } });
            await updateVersion({ dataSourceName, fileNames: [fileName], versionDescription: 'my testing version' });
            const pipeline = {
                name: uuid(),
                nodes: [{
                    nodeName: 'node1',
                    algorithmName: 'green-alg',
                    input: [`@${ds}`]
                }]
            }
            const res = await request({ uri: `${restUrl}/exec/raw`, body: pipeline });
            console.log(res.body);
            const response = await request({ method: 'GET', uri: `${restUrl}/exec/pipelines/${res.body.jobId}` });
            expect(response.body.dataSourceMetadata).to.have.property(ds);
        });
    });
    describe('datasource/id/:id GET', () => {
        it('should fetch by id', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({ body: { name } });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await updateVersion({ dataSourceName: name, fileNames: [secondFileName] });
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
            const { body: oldVersion } = await fetchDataSource({ id: firstVersion.id });
            expect(oldVersion.id).to.eq(firstVersion.id);
        });
    });
    describe('/datasource/:name GET', () => {
        it('should throw error datasource not found', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.match(/Not Found/i);
        });
        it('should fail fetching dataSource', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}`,
                method: 'GET'
            };
            sinon.stub(dbConnection.connection.dataSources, "fetch").rejects({ message: 'i should throw' });
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.INTERNAL_SERVER_ERROR);
            expect(response.body.error.message).to.eq('i should throw');
        });
        it('should return specific datasource', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const { response: getResponse } = await fetchDataSource({ name });
            const { body: dataSource } = getResponse;
            expect(dataSource).to.have.property('id');
            expect(dataSource.id).to.be.string;
            expect(dataSource).to.have.property('name');
            expect(dataSource.name).to.eq(name);
            expect(dataSource).to.have.property('files');
            dataSource.files.forEach(file => {
                expect(file).to.have.property('id');
                expect(file).to.have.property('name');
                expect(file).to.have.property('path');
                expect(file).to.have.property('size');
                expect(file).to.have.property('type');
            });
        });
        it('should fetch an older version', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({ body: { name } });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await updateVersion({ dataSourceName: name, fileNames: [secondFileName] });
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
            const { body: oldVersion } = await fetchDataSource({ name, id: firstVersion.id });
            expect(oldVersion.id).to.eq(firstVersion.id);
        });
        it('should fail if version_id does not match the name', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({ body: { name } });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await updateVersion({ dataSourceName: name, fileNames: [secondFileName] });
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
            const { body: errorBody } = await fetchDataSource({ name: 'not real name', id: firstVersion.id });
            expect(errorBody).to.have.property('error');
            expect(errorBody.error.code).to.eq(400);
            expect(errorBody.error.message).to.match(/version_id (.+) does not exist for name (.+)/i);
        });
    });
    describe.skip('datasource/:name/:fileName GET', () => {
        it('should fetch a file', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const options = {
                uri: `${restPath}/${name}/${fileName}`,
                method: 'GET'
            };
            const { response: fetchFileResponse } = await request(options);
            expect(fetchFileResponse.statusCode).to.eq(HttpStatus.OK);
            expect(fetchFileResponse.body).to.be.string;
            const fileContent = fse.readFileSync(`tests/mocks/${fileName}`).toString();
            expect(fileContent).to.eq(fetchFileResponse.body);
        });
        it('should fail fetching a file', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const options = {
                uri: `${restPath}/${name}/${fileName}`,
                method: 'GET'
            };
            sinon.stub(storage.hkubeDataSource, 'getStream').rejects({ message: 'failed on purpose' });
            const { response: fetchFileResponse } = await request(options);
            expect(fetchFileResponse.body.error.message).to.match(/failed on purpose/i);
            expect(fetchFileResponse.statusCode).to.eq(HttpStatus.BAD_REQUEST);
        });
        it('non-existing dataSource id', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}/${fileName}`,
                method: 'GET'
            };
            const { response: fetchFileResponse } = await request(options);
            expect(fetchFileResponse.body.error.message).to.match(/Not Found/i);
            expect(fetchFileResponse.statusCode).to.eq(404);
        });
        it('invalid file name', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const options = {
                uri: `${restPath}/${name}/wrong-file-name`,
                method: 'GET'
            };
            const { response: fetchFileResponse } = await request(options);
            expect(fetchFileResponse.body.error.message).to.match(/Not Found/i);
            expect(fetchFileResponse.statusCode).to.eq(404);
        });
    });
    describe.skip('/datasource/:name DELETE', () => {
        it('should delete a datasource given an id', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const options = {
                uri: `${restPath}/${name}`,
                method: 'DELETE'
            };
            const { response: deleteResponse } = await request(options);
            expect(deleteResponse.statusCode).to.eq(HttpStatus.OK);
        });
        it('should return 404 if dataSource is not found', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}`,
                method: 'DELETE'
            };
            const { response } = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`dataSource ${nonExistingId} Not Found`);
        });
    });
    describe('/datasource GET', () => {
        it('should success to get list of dataSources', async () => {
            const names = new Array(3).fill(0).map(() => uuid());
            await Promise.all(
                names.map(name => createDataSource({ body: { name } }))
            );
            const options = {
                uri: restPath,
                method: 'GET'
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
            const fileNames = ['README-2.md', 'algorithms.json']
            await updateVersion({ dataSourceName: name, fileNames });
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const { body } = await request(options);
            const ds = body.find(item => item.name === name);
            const { fileTypes } = ds;
            expect(fileTypes).to.eql(['text/markdown', 'application/json']);
            expect(fileTypes).to.have.lengthOf([...new Set(fileTypes)].length);
        });
    });
    describe('/datasource POST', () => {
        describe('validation', () => {
            it('should throw validation error of required property name', async () => {
                const response = await createDataSource();
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal("data should have required property 'name'");
            });
            it('should throw validation error of long datasource name', async () => {
                const response = await createDataSource({
                    body: {
                        name: 'this-is-33-length-algorithm--name'
                    }
                });
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal("data.name should NOT be longer than 32 characters");
            });
            it('should throw validation error of data.name should be string', async () => {
                // @ts-expect-error
                const response = await createDataSource({ body: { name: [1, 2] } });
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('data.name should be string');
            });
            it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                const response = await createDataSource({ body: { name: '' } });
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
            });
            it('should throw missing file error', async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: 'my-dataSource',
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal("data should have required property 'files'");
            });
            const invalidChars = ['/', '*', '#', '"', '%'];
            invalidChars.forEach((v) => {
                it(`should throw invalid dataSource name if include ${v}`, async () => {
                    const response = await createDataSource({ body: { name: `not-valid${v}name` } });
                    expect(response.body).to.have.property('error');
                    expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                    expect(response.body.error.message).to.equal(validationMessages.DATASOURCE_NAME_FORMAT);
                });
            });
            const invalidStartAndEndChars = ['/', '*', '#', '"', '%'];
            invalidStartAndEndChars.forEach((v) => {
                it(`should throw invalid if dataSource name if start with ${v}`, async () => {
                    const response = await createDataSource({ body: { name: `${v}notvalidname` } });
                    expect(response.body).to.have.property('error');
                    expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                    expect(response.body.error.message).to.equal(validationMessages.DATASOURCE_NAME_FORMAT);
                });
                it(`should throw invalid if dataSource name if end with ${v}`, async () => {
                    const response = await createDataSource({ body: { name: `notvalidname${v}` } });
                    expect(response.body).to.have.property('error');
                    expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                    expect(response.body.error.message).to.equal(validationMessages.DATASOURCE_NAME_FORMAT);
                });
            });
        });
        describe('create', () => {
            it("should create a new dataSource and return it's newly created id and files list", async () => {
                const name = uuid();
                const { response } = await createDataSource({ body: { name } });
                expect(response.statusCode).to.eql(HttpStatus.CREATED);
                expect(response.body).to.have.property('id');
                expect(response.body).to.have.property('name');
                expect(response.body).to.have.property('files');
                expect(response.body.id).to.be.string;
                expect(response.body.name).to.eq(name);
                expect(response.body.files).to.have.lengthOf(1);
            });
            it('should throw conflict error', async () => {
                const name = uuid();
                const firstResponse = await createDataSource({ body: { name } });
                expect(firstResponse.response.statusCode).to.eql(HttpStatus.CREATED);
                const secondResponse = await createDataSource({ body: { name } });
                expect(secondResponse.response.statusCode).to.equal(HttpStatus.CONFLICT);
                expect(secondResponse.body).to.have.property('error');
                expect(secondResponse.body.error.message).to.contain('already exists');
            });
            it.skip('should roll back the creating of the dataSource on errors', async () => {
                sinon.stub(storage.hkubeDataSource, "putStream").rejects('i should reject');
                const name = uuid();
                const { response } = await createDataSource({ body: { name } });
                expect(response.statusCode).to.eql(HttpStatus.INTERNAL_SERVER_ERROR);
                sinon.restore();
                const { body: fetchResponse } = await fetchDataSource({ name });
                expect(fetchResponse.error.code).to.eql(HttpStatus.NOT_FOUND);
            });
            it('should configure the new dataSource remote storage', async () => {
                const name = uuid();
                await createDataSource({ body: { name } });
                const config = fse.readFileSync(`${DATASOURCE_GIT_REPOS_DIR}/${name}/.dvc/config`, 'utf8');
                expect(config).to.match(new RegExp(name));
            });
            it('should push to dvc host', async () => {
                const name = uuid();
                await createDataSource({ body: { name } });
                expect(await fse.ensureDir(`${STORAGE_DIR}/${name}`));
            });
        });
    });
    describe('/datasource/:name PUT', () => {
    });
    describe('/datasource/:name POST', () => {
        // update after adding ajv validation on the service
        it.skip('should throw missing filesAdded and filesDropped error', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const { response: uploadResponse } = await updateVersion({ dataSourceName: name });
            expect(uploadResponse.body).to.have.property('error');
            expect(uploadResponse.body.error.message).to.match(/data should have required property '.filesAdded'/i);
            expect(uploadResponse.body.error.message).to.match(/data should have required property '.filesDropped'/i);
        });
        it('should fail uploading a file to a non existing dataSource', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const { response: uploadResponse } = await updateVersion({ dataSourceName: 'non-existing', fileNames: ['README-2.md'] });
            expect(uploadResponse.body).to.have.property('error');
            expect(uploadResponse.body.error.message).to.match(/not found/i);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.NOT_FOUND);
        });
        it('should upload a new file to the dataSource and get a new version', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({ body: { name } });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await updateVersion({ dataSourceName: name, fileNames: [secondFileName] });
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(firstVersion.name).to.eq(updatedVersion.name);
            const { files } = updatedVersion;
            expect(files).to.have.lengthOf(2);
            files.forEach(file => {
                expect(file).to.have.property('name');
                expect(file).to.have.property('path');
                expect(file).to.have.property('size');
                expect(file).to.have.property('type');
            });
            const { response: fetchDataSourceResponse } = await fetchDataSource({ name });
            const { body: dataSource } = fetchDataSourceResponse;
            expect(dataSource.files).to.have.lengthOf(2);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
        });
        it('should upload multiple files to the dataSource', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const { response: uploadResponse } = await updateVersion({
                dataSourceName: name,
                files: [{ name: 'algorithms.json', id: uuid() }, { name: 'README-2.md', id: 'someID' }],
                mapping: [
                    { id: 'someID', name: 'README-2.md', path: '/someSubDir' }
                ]
            });
            const { body: { files } } = uploadResponse;
            files.forEach(file => {
                expect(file).to.have.property('name');
                expect(file).to.have.property('path');
            });
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/someSubDir/README-2.md`));
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/someSubDir/README-2.md.dvc`));
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json`));
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json.dvc`));
            const { response: fetchDataSourceResponse } = await fetchDataSource({ name });
            const { body: dataSource } = fetchDataSourceResponse;
            expect(dataSource.files).to.have.lengthOf(3);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
        });
        it('should move a file', async () => {
            const name = uuid();
            const { body: dataSource } = await createDataSource({ body: { name } });
            const [existingFile] = dataSource.files;
            const { response: uploadResponse } = await updateVersion({
                dataSourceName: name,
                files: [{ name: 'algorithms.json', id: uuid() }, { name: 'README-2.md', id: 'someID' }],
                mapping: [
                    { id: 'someID', name: 'README-2.md', path: '/someSubDir' },
                    { id: existingFile.id, name: existingFile.name, path: '/a new directory' }
                ]
            });
            const { body: { files } } = uploadResponse;
            const updatedFile = files.find(file => file.id === existingFile.id);
            expect(updatedFile).to.exist;
            expect(updatedFile.path).to.equal('/a-new-directory');
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/a-new-directory/${existingFile.name}`));
        });
        it('delete a file', async () => {
            const name = uuid();
            const { body: dataSource } = await createDataSource({ body: { name } });
            const [existingFile] = dataSource.files;
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`)).to.be.true;

            await updateVersion({
                dataSourceName: name,
                fileNames: ['algorithms.json'],
                droppedFileIds: [existingFile.id]
            });

            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/algorithms.json`)).to.be.true;
            // the data file is not deleted only the .dvc file
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`)).to.be.false;
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`)).to.be.false;
        });
        it('should return status 200 if nothing was updated', async () => {
            const name = uuid();
            const { body: dataSource } = await createDataSource({ body: { name } });
            const [existingFile] = dataSource.files;
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`)).to.be.true;
            const uploadResponse = await updateVersion({
                dataSourceName: name,
                fileNames: [existingFile.name],
                mapping: [existingFile]
            });
            expect(uploadResponse.response.statusCode).to.eq(HttpStatus.OK);
        });
        it('should update a file', async () => {
            const name = uuid();
            const { body: dataSource } = await createDataSource({ body: { name } });
            const [existingFile] = dataSource.files;
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}.dvc`)).to.be.true;
            expect(await fse.statSync(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`).size).to.eq(108);
            const uploadResponse = await updateVersion({
                dataSourceName: name,
                fileNames: ['updatedVersions/README-1.md'],
                mapping: [existingFile]
            });
            const { body: uploadResponseBody } = uploadResponse;
            // the data file is not deleted only the .dvc file
            expect(await fse.pathExists(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`)).to.be.true;
            expect(await fse.statSync(`${DATASOURCE_GIT_REPOS_DIR}/${name}/data/${existingFile.name}`).size).to.eq(132);
            expect(dataSource.versionId).not.to.eq(uploadResponseBody.versionId);
            expect(dataSource.files.length).to.eq(uploadResponseBody.files.length);
            expect(uploadResponseBody.files[0].size).to.eq(132)
        });
    });
});

