const { expect } = require('chai');
const fse = require('fs-extra');
const { StatusCodes } = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const validationMessages = require('../lib/consts/validationMessages.js');
const { createDataSource } = require('./api');
const { mockDeleteClone } = require('./utils');

let DATASOURCE_GIT_REPOS_DIR;

describe('/dataSource POST', () => {
    before(() => {
        // @ts-ignore
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
    });
    describe('validation', () => {
        it('should throw missing git information', async () => {
            const name = uuid();
            const response = await createDataSource({
                body: { name: name },
                ignoreGit: true,
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.eq(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.match(
                /should have required property 'git'/i
            );
        });
        it('should throw missing storage information', async () => {
            const name = uuid();
            const response = await createDataSource({
                body: { name: name },
                ignoreStorage: true,
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.eq(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.match(
                /should have required property 'storage'/i
            );
        });
        it('should throw validation error of required property name', async () => {
            const response = await createDataSource();
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                "data should have required property 'name'"
            );
        });
        it('should throw validation error of long dataSource name', async () => {
            const response = await createDataSource({
                body: {
                    name: 'this-is-33-length-dataSource-name',
                },
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                'data.name should NOT be longer than 32 characters'
            );
        });
        it('should throw validation error of data.name should be string', async () => {
            const response = await createDataSource({
                body: { name: [1, 2] },
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                'data.name should be string'
            );
        });
        it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
            const response = await createDataSource({ body: { name: '' } });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                'data.name should NOT be shorter than 1 characters'
            );
        });
        const invalidChars = ['/', '*', '#', '"', '%'];
        invalidChars.forEach(v => {
            it(`should throw invalid dataSource name if include ${v}`, async () => {
                const response = await createDataSource({
                    body: { name: `not-valid${v}name` },
                });
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(
                    StatusCodes.BAD_REQUEST
                );
                expect(response.body.error.message).to.equal(
                    validationMessages.DATASOURCE_NAME_FORMAT
                );
            });
        });
        const invalidStartAndEndChars = ['/', '*', '#', '"', '%'];
        invalidStartAndEndChars.forEach(v => {
            it(`should throw invalid if dataSource name if start with ${v}`, async () => {
                const response = await createDataSource({
                    body: { name: `${v}notvalidname` },
                });
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(
                    StatusCodes.BAD_REQUEST
                );
                expect(response.body.error.message).to.equal(
                    validationMessages.DATASOURCE_NAME_FORMAT
                );
            });
            it(`should throw invalid if dataSource name if end with ${v}`, async () => {
                const response = await createDataSource({
                    body: { name: `notvalidname${v}` },
                });
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(
                    StatusCodes.BAD_REQUEST
                );
                expect(response.body.error.message).to.equal(
                    validationMessages.DATASOURCE_NAME_FORMAT
                );
            });
        });
        describe('S3 config', () => {
            it('should throw invalid accessKeyId', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    storageOverrides: {
                        accessKeyId: 'invalid',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.eq(
                    'Invalid S3 accessKeyId or secretAccessKey'
                );
            });
            it('should throw invalid host - non existing', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    storageOverrides: {
                        endpoint: 'https://non-valid.com',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.eq('Invalid S3 endpoint');
            });
            it('should throw invalid host - bad url', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    storageOverrides: {
                        endpoint: 'non-valid',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.match(/invalid url/i);
            });
            it('should throw invalid bucket name', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    storageOverrides: {
                        bucketName: 'not-exist',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.eq(
                    'S3 bucket name does not exist'
                );
            });
            it('should throw invalid bucket name - without uploading files', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    storageOverrides: {
                        bucketName: 'not-exist',
                    },
                    fileNames: [],
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.eq(
                    'S3 bucket name does not exist'
                );
            });
            it('should throw invalid token - without uploading files', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    storageOverrides: {
                        accessKeyId: 'bad key id',
                    },
                    fileNames: [],
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.eq(
                    'Invalid S3 accessKeyId or secretAccessKey'
                );
            });
            it('should throw invalid secretAccessKey', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    storageOverrides: {
                        secretAccessKey: 'invalid',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.eq(
                    'Invalid S3 accessKeyId or secretAccessKey'
                );
            });
        });
        describe('Git config', () => {
            it('should throw invalid kind', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    gitOverrides: {
                        kind: 'non-existing',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.match(
                    /be equal to one of the allowed values/
                );
            });
            it('should throw invalid token', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    gitOverrides: {
                        token: 'bad-token',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.match(/Invalid git token/);
            });
            it('should throw invalid organization', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    gitOverrides: {
                        organization: 'non-existing',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.match(
                    /Invalid Git endpoint or organization/i
                );
            });
            it('should throw invalid endpoint', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    gitOverrides: {
                        endpoint: 'https://not-existing.com',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.match(
                    /invalid git endpoint or organization name/i
                );
            });
            it('should throw invalid endpoint - bad format', async () => {
                const name = uuid();
                const { body } = await createDataSource({
                    body: { name },
                    gitOverrides: {
                        endpoint: 'non-existing',
                    },
                });
                expect(body).to.have.ownProperty('error');
                expect(body.error.code).to.eq(400);
                expect(body.error.message).to.match(/invalid url/i);
            });
        });
    });
    describe('create', () => {
        it("should create a new dataSource and return it's newly created id and files list", async () => {
            const name = uuid();
            const deleteClone = mockDeleteClone();
            const {
                response: { statusCode },
                body: dataSource,
            } = await createDataSource({ body: { name } });
            expect(deleteClone.getCalls()).to.have.lengthOf(1);
            expect(statusCode).to.eql(StatusCodes.CREATED);
            expect(dataSource).to.have.keys(
                'id',
                'name',
                'files',
                'fileTypes',
                'commitHash',
                'avgFileSize',
                'repositoryUrl',
                'versionDescription',
                'filesCount',
                'totalSize'
            );
            expect(dataSource.id).to.be.string;
            expect(dataSource.name).to.eq(name);
            expect(dataSource.files).to.have.lengthOf(1);
            expect(dataSource.repositoryUrl).to.match(/\/hkube\//i);
            expect(
                await fse.pathExists(
                    `${DATASOURCE_GIT_REPOS_DIR}/${name}/.dvc/config.template`
                )
            ).to.be.true;
        });
        it('should create a dataSource under a git organization', async () => {
            const name = uuid();
            const deleteClone = mockDeleteClone();
            const {
                response: { statusCode },
                body: dataSource,
            } = await createDataSource({
                body: { name },
                useGitOrganization: true,
            });

            expect(deleteClone.getCalls()).to.have.lengthOf(1);
            expect(statusCode).to.eql(StatusCodes.CREATED);
            expect(dataSource.repositoryUrl).to.match(/\/hkube-org\//i);
            const hkubeFile = await fse.readFile(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/.dvc/hkube`,
                'utf8'
            );
            expect(JSON.parse(hkubeFile)).to.eql({ repositoryName: name });
            const config = fse.readFileSync(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/.dvc/config.local`,
                'utf8'
            );
            expect(config).to.match(new RegExp(name));
        });
        it('should create a dataSource using internal git', async () => {
            const name = uuid();
            const {
                response: { statusCode },
            } = await createDataSource({
                body: { name },
                useInternalGit: true,
            });
            expect(statusCode).to.eq(201);
        });
        it('should create a dataSource using internal storage', async () => {
            const name = uuid();
            const {
                response: { statusCode },
            } = await createDataSource({
                body: { name },
                useInternalStorage: true,
            });
            expect(statusCode).to.eq(201);
        });
        it.skip('should create a dataSource using gitlab', async () => {
            const name = uuid();
            const deleteClone = mockDeleteClone();
            const {
                response: { statusCode },
            } = await createDataSource({
                body: { name },
                useGitlab: true,
            });
            expect(deleteClone.getCalls()).to.have.lengthOf(1);
            expect(statusCode).to.eql(StatusCodes.CREATED);
            const hkubeFile = await fse.readFile(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/.dvc/hkube`,
                'utf8'
            );
            expect(JSON.parse(hkubeFile)).to.eql({ repositoryName: name });
            const config = fse.readFileSync(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/.dvc/config.local`,
                'utf8'
            );
            expect(config).to.match(new RegExp(name));
        });
        it('should create an empty dataSource', async () => {
            const name = uuid();
            const { response } = await createDataSource({
                body: { name },
                fileNames: [],
            });
            expect(response.statusCode).to.eql(StatusCodes.CREATED);
            expect(response.body).to.have.property('files');
            expect(response.body.files).to.have.lengthOf(0);
        });
        it('should throw conflict error', async () => {
            const name = uuid();
            const firstResponse = await createDataSource({
                body: { name },
            });
            expect(firstResponse.response.statusCode).to.eql(
                StatusCodes.CREATED
            );
            const secondResponse = await createDataSource({
                body: { name },
            });
            expect(secondResponse.response.statusCode).to.equal(
                StatusCodes.CONFLICT
            );
            expect(secondResponse.body).to.have.property('error');
            expect(secondResponse.body.error.message).to.contain(
                'already exists'
            );
        });
        it('should upload a file with meta data', async () => {
            const name = uuid();
            const { body: dataSource } = await createDataSource({
                body: { name },
                fileNames: ['logo.svg', 'logo.svg.meta'],
            });
            const [createdFile] = dataSource.files;
            expect(createdFile).to.have.ownProperty('meta');
            expect(createdFile.meta).to.match(/information about the logo/i);
        });
    });
});
