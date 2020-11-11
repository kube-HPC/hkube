const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const sinon = require('sinon');
const stateManager = require('../lib/state/state-manager');
const validationMessages = require('../lib/consts/validationMessages.js');
const { request } = require('./utils');
const dbConnection = require('../lib/db');
const storage = require('@hkube/storage-manager');
let restUrl, restPath;

// a valid mongo ObjectID;
const nonExistingId = '5f953d50dd38c8291924a0a3';
const fileName = 'README-1.md';

/** @type {(props?: { body?: { name?:string }, withFile?:boolean, uri?: string, fileNames?: string[] }) => Promise<any>} */
const createDataSource = ({
    body = {},
    withFile = true,
    fileNames = [fileName],
    uri = restPath,
} = {}) => {
    const formData = {
        ...body,
        files: withFile ? fileNames.map(name => fse.createReadStream(`tests/mocks/${name}`)) : undefined
    };
    const options = {
        uri,
        formData
    };
    return request(options);
};

const uploadFile = (dataSourceId, fileNames = [], versionDescription = 'new-version') => {
    const formData = fileNames.length > 0 ? {
        versionDescription,
        filesAdded: fileNames.length > 0 ? fileNames.map(fileName => fse.createReadStream(`tests/mocks/${fileName}`)) : undefined
    } : { versionDescription };
    const options = {
        uri: `${restPath}/${dataSourceId}`,
        formData
    };
    return request(options);
};

const fetchDataSource = (dataSourceId) => {
    const getOptions = {
        uri: `${restPath}/${dataSourceId}`,
        method: 'GET'
    };
    return request(getOptions);
};

describe('Datasource', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/datasource`;
    });
    afterEach(() => sinon.restore());
    describe('/datasource/exec/raw', () => {
        it('should succeed and return job id', async () => {
            const dataSourceName = uuid();
            const ds = `dataSource.${dataSourceName}/${fileName}`;
            await createDataSource({ body: { name: dataSourceName } });
            const pipeline = {
                name: uuid(),
                nodes: [{
                    nodeName: 'node1',
                    algorithmName: 'green-alg',
                    input: [`@${ds}`]
                }]
            }
            const res = await request({ uri: `${restUrl}/exec/raw`, body: pipeline });
            const response = await request({ method: 'GET', uri: `${restUrl}/exec/pipelines/${res.body.jobId}` });
            expect(response.body.dataSourceMetadata).to.have.property(ds);
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
            const { response: getResponse } = await fetchDataSource(name);
            const { body: dataSource } = getResponse;
            expect(dataSource).to.have.property('id');
            expect(dataSource.id).to.be.string;
            expect(dataSource).to.have.property('name');
            expect(dataSource.name).to.eq(name);
            expect(dataSource).to.have.property('files');
            dataSource.files.forEach(file => {
                expect(file).to.have.property('path');
                expect(file).to.have.property('size');
                expect(file).to.have.property('mtime');
            });
        });
    });
    describe('datasource/:name/:fileName GET', () => {
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
    describe('/datasource/:name DELETE', () => {
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
        it.skip('should return status 400 if invalid id was provided', async () => {
            const dataSourceId = 'non-12-bytes-string-of-hex-characters';
            const options = {
                uri: `${restPath}/${dataSourceId}`,
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`you provided an invalid id ${dataSourceId}`);
        });
        it.skip('should throw error on related data', async () => {
            const algorithmName = `delete-${uuid()}`;
            const algorithm = {
                uri: restPath,
                body: {
                    name: algorithmName,
                    algorithmImage: "image"
                }
            };
            const store = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: `delete-${uuid()}`,
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName,
                            input: []
                        }

                    ]
                }
            };
            const exec = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: store.body.name
                }
            };

            const resAlg = await request(algorithm);
            await request(store);
            await request(exec);
            await stateManager.algorithms.versions.set(resAlg.body);
            await stateManager.algorithms.builds.set({ buildId: `${algorithmName}-1`, algorithmName });
            await stateManager.algorithms.builds.set({ buildId: `${algorithmName}-2`, algorithmName });

            const optionsDelete = {
                uri: `${restPath}/${algorithmName}?force=false`,
                method: 'DELETE'
            };
            const response = await request(optionsDelete);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain('you must first delete all related data');
        });
        it.skip('should delete datasource with related data with force', async () => {
            const algorithmName = `my-alg-${uuid()}`;
            const algorithmImage = `${algorithmName}-image`;
            const formData = {
                payload: JSON.stringify({ name: algorithmName, env: 'nodejs' }),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const resApply = await request({ uri: `${restPath}/apply`, formData });
            const storePipeline = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: `delete-${uuid()}`,
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName,
                            input: []
                        }

                    ]
                }
            };
            const execPipeline = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: storePipeline.body.name
                }
            };

            await request(storePipeline);
            await request(execPipeline);
            await stateManager.algorithms.versions.set({ ...resApply.body.algorithm, algorithmImage });

            const optionsDelete = {
                uri: `${restPath}/${algorithmName}?force=true`,
                method: 'DELETE'
            };
            const response = await request(optionsDelete);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.contain('related data deleted');
        });
        it.skip('should delete specific datasource without related data', async () => {
            const optionsInsert = {
                uri: restPath,
                body: {
                    name: 'delete',
                    algorithmImage: 'image'
                }
            };
            await request(optionsInsert);

            const options = {
                uri: restPath + '/delete?force=true',
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.contain('successfully deleted from store');
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
            it("should create a new dataSource and return it's newly created id", async () => {
                const name = uuid();
                const { response } = await createDataSource({ body: { name } });
                expect(response.statusCode).to.eql(HttpStatus.CREATED);
                expect(response.body).to.have.property('id');
                expect(response.body).to.have.property('name');
                expect(response.body.id).to.be.string;
                expect(response.body.name).to.eq(name);
            });
            it("should create a new dataSource and return it's newly created id", async () => {
                const name = uuid();
                const { response } = await createDataSource({ body: { name } });
                expect(response.statusCode).to.eql(HttpStatus.CREATED);
                expect(response.body).to.have.property('id');
                expect(response.body).to.have.property('name');
                expect(response.body.id).to.be.string;
                expect(response.body.name).to.eq(name);
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
            it('should roll back the creating of the dataSource on errors', async () => {
                const deleteDataSourceSpy = sinon.stub(dbConnection.connection.dataSources, "delete");
                sinon.stub(storage.hkubeDataSource, "putStream").rejects('i should reject');
                const name = uuid();
                const { response } = await createDataSource({ body: { name } });
                expect(response.statusCode).to.eql(HttpStatus.INTERNAL_SERVER_ERROR);
                const spyCalls = deleteDataSourceSpy.getCalls();
                expect(spyCalls).to.have.length(1);
                const [deleteCall] = spyCalls;
                expect(deleteCall.firstArg).to.be.string;
                expect(deleteCall.lastArg).to.eql({ allowNotFound: true });
            }); describe('/datasource/:name PUT', () => {
            });
        });
    });
    describe('/datasource/:name POST', () => {
        it('should throw missing filesAdded and filesDropped error', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const { response: uploadResponse } = await uploadFile(name);
            expect(uploadResponse.body).to.have.property('error');
            expect(uploadResponse.body.error.message).to.match(/data should have required property '.filesAdded'/i);
            expect(uploadResponse.body.error.message).to.match(/data should have required property '.filesDropped'/i);
        });
        it('should fail uploading a file to a non existing dataSource', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const { response: uploadResponse } = await uploadFile('non-existing', ['README-2.md']);
            expect(uploadResponse.body).to.have.property('error');
            expect(uploadResponse.body.error.message).to.match(/not found/i);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.NOT_FOUND);
        });
        it('should upload a new file to the dataSource and get a new version', async () => {
            const name = uuid();
            const { body: firstVersion } = await createDataSource({ body: { name } });
            const secondFileName = 'README-2.md';
            const { response: uploadResponse } = await uploadFile(name, [secondFileName]);
            const { body: updatedVersion } = uploadResponse;
            expect(firstVersion.id).not.to.eq(updatedVersion.id);
            expect(firstVersion.name).to.eq(updatedVersion.name);
            const { files } = updatedVersion;
            expect(files).to.have.lengthOf(1);
            files.forEach(file => {
                expect(file).to.have.property('name');
                expect(file).to.have.property('path');
                expect(file).to.have.property('size');
                expect(file).to.have.property('type');
            });
            const { response: fetchDataSourceResponse } = await fetchDataSource(name);
            const { body: dataSource } = fetchDataSourceResponse;
            expect(dataSource.files).to.have.lengthOf(2);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
        });
        it('should upload multiple files to the dataSource', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const fileNames = ['README-2.md', 'algorithms.json'];
            const { response: uploadResponse } = await uploadFile(name, fileNames);
            const { body: { files } } = uploadResponse;
            files.forEach(file => {
                expect(file).to.have.property('name');
                expect(file).to.have.property('path');
            });
            const { response: fetchDataSourceResponse } = await fetchDataSource(name);
            const { body: dataSource } = fetchDataSourceResponse;
            expect(dataSource.files).to.have.lengthOf(3);
            expect(uploadResponse.statusCode).to.eql(HttpStatus.CREATED);
        });
    });
});
