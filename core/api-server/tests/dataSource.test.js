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

/** @type {(props?: { body?: { name?:string }, withFile?:boolean, uri?: string }) => Promise<any>} */
const createDataSource = ({
    body = {},
    withFile = true,
    uri = restPath,
} = {}) => {
    const formData = {
        ...body,
        file: withFile ? fse.createReadStream(`tests/mocks/${fileName}`) : undefined
    };
    const options = {
        uri,
        formData
    };
    return request(options);
};

const uploadFile = (dataSourceId, fileName) => {
    const formData = fileName ? {
        file: fse.createReadStream(`tests/mocks/${fileName}`)
    } : {};
    const options = {
        uri: `${restPath}/${dataSourceId}`,
        method: 'PUT',
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
    describe('/datasource/:id GET', () => {
        it('should throw error datasource not found', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`dataSource ${nonExistingId} Not Found`);
        });
        it('should return specific datasource', async () => {
            const name = uuid();
            const { response } = await createDataSource({ body: { name } });
            const { id: createdId } = response.body;
            const { response: getResponse } = await fetchDataSource(createdId);
            const { body: dataSource } = getResponse;
            expect(dataSource).to.have.property('id');
            expect(dataSource.id).to.be.string;
            expect(dataSource).to.have.property('name');
            expect(dataSource.name).to.eq(name);
            expect(dataSource).to.have.property('files');
            dataSource.files.forEach(file => {
                expect(file).to.have.property('href');
                expect(file).to.have.property('name');
                expect(file).to.have.property('type');
            });
        });
    });
    describe('datasource/:id/:fileName GET', () => {
        it('should fetch a file', async () => {
            const name = uuid();
            const { response: createResponse } = await createDataSource({ body: { name } });
            const options = {
                uri: `${restPath}/${createResponse.body.id}/${fileName}`,
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
            const { response: createResponse } = await createDataSource({ body: { name } });
            const options = {
                uri: `${restPath}/${createResponse.body.id}/${fileName}`,
                method: 'GET'
            };
            sinon.stub(storage.hkubeDataSource, 'getStream').rejects('reject message');
            const { response: fetchFileResponse } = await request(options);
            expect(fetchFileResponse.body.error.message).to.match(/could not fetch the file/i);
            expect(fetchFileResponse.statusCode).to.eq(HttpStatus.INTERNAL_SERVER_ERROR);
        });
        it('invalid dataSource id', async () => {
            const options = {
                uri: `${restPath}/${nonExistingId}/${fileName}`,
                method: 'GET'
            };
            const { response: fetchFileResponse } = await request(options);
            expect(fetchFileResponse.body).to.have.property('error');
            expect(fetchFileResponse.statusCode).to.eq(404);
        });
        it('invalid file name', async () => {
            const name = uuid();
            const { response: createResponse } = await createDataSource({ body: { name } });
            const options = {
                uri: `${restPath}/${createResponse.body.id}/wrong-file-name`,
                method: 'GET'
            };
            const { response: fetchFileResponse } = await request(options);
            expect(fetchFileResponse.body).to.have.property('error');
            expect(fetchFileResponse.statusCode).to.eq(404);
        });
    });
    describe('/datasource/:id DELETE', () => {
        it('should delete a datasource given an id', async () => {
            const name = uuid();
            const { response } = await createDataSource({ body: { name } });
            const { id } = response.body;
            const options = {
                uri: `${restPath}/${id}`,
                method: 'DELETE'
            };
            const { response: deleteResponse } = await request(options);
            expect(deleteResponse.statusCode).to.eq(HttpStatus.OK);
        });
        it('should return status 400 if invalid id was provided', async () => {
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
                expect(response.body.error.message).to.equal("data should have required property 'file'");
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
            }); describe('/datasource/:id PUT', () => {
            });
        });
        describe('/datasource/:id PUT', () => {
            it('should throw missing file error', async () => {
                const name = uuid();
                const { response: createResponse } = await createDataSource({ body: { name } });
                const { id: createdId } = createResponse.body;
                const { response: putResponse } = await uploadFile(createdId);
                expect(putResponse.body).to.have.property('error');
                expect(putResponse.body.error.message).to.equal("data should have required property 'file'");
            });
            it('should upload a new file to the dataSource', async () => {
                const name = uuid();
                const { response: createResponse } = await createDataSource({ body: { name } });
                const { id: createdId } = createResponse.body;
                const secondFileName = 'README-2.md';
                const { response: putResponse } = await uploadFile(createdId, secondFileName);
                const { body: file } = putResponse;
                expect(file).to.have.property('name');
                expect(file).to.have.property('href');
                const { response: fetchDataSourceResponse } = await fetchDataSource(createdId);
                const { body: dataSource } = fetchDataSourceResponse;
                expect(dataSource.files).to.have.lengthOf(2);
            });
        });
    });
});
