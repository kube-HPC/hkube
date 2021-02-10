const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const validationMessages = require('../lib/consts/validationMessages.js');
const { createDataSource } = require('./api');
const { mockDeleteClone } = require('./utils');

let DATASOURCE_GIT_REPOS_DIR;

describe('/datasource POST', () => {
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
            expect(response.body.error.code).to.eq(HttpStatus.BAD_REQUEST);
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
            expect(response.body.error.code).to.eq(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.match(
                /should have required property 'storage'/i
            );
        });
        it('should throw validation error of required property name', async () => {
            const response = await createDataSource();
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                "data should have required property 'name'"
            );
        });
        it('should throw validation error of long datasource name', async () => {
            const response = await createDataSource({
                body: {
                    name: 'this-is-33-length-datasource-name',
                },
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                'data.name should NOT be longer than 32 characters'
            );
        });
        it('should throw validation error of data.name should be string', async () => {
            const response = await createDataSource({
                body: { name: [1, 2] },
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                'data.name should be string'
            );
        });
        it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
            const response = await createDataSource({ body: { name: '' } });
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
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
                    HttpStatus.BAD_REQUEST
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
                    HttpStatus.BAD_REQUEST
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
                    HttpStatus.BAD_REQUEST
                );
                expect(response.body.error.message).to.equal(
                    validationMessages.DATASOURCE_NAME_FORMAT
                );
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
            expect(statusCode).to.eql(HttpStatus.CREATED);
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
        });
        it('should create a datasource under a git organization', async () => {
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
            expect(statusCode).to.eql(HttpStatus.CREATED);
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
        it.skip('should create a datasource using gitlab', async () => {
            const name = uuid();
            const deleteClone = mockDeleteClone();
            const {
                response: { statusCode },
            } = await createDataSource({
                body: { name },
                useGitlab: true,
            });
            expect(deleteClone.getCalls()).to.have.lengthOf(1);
            expect(statusCode).to.eql(HttpStatus.CREATED);
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
            expect(response.statusCode).to.eql(HttpStatus.CREATED);
            expect(response.body).to.have.property('files');
            expect(response.body.files).to.have.lengthOf(0);
        });
        it('should throw conflict error', async () => {
            const name = uuid();
            const firstResponse = await createDataSource({
                body: { name },
            });
            expect(firstResponse.response.statusCode).to.eql(
                HttpStatus.CREATED
            );
            const secondResponse = await createDataSource({
                body: { name },
            });
            expect(secondResponse.response.statusCode).to.equal(
                HttpStatus.CONFLICT
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
