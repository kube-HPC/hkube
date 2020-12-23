const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const validationMessages = require('../lib/consts/validationMessages.js');
const { request } = require('./request');
const { createDataSource } = require('./utils');
const sinon = require('sinon');

let restUrl, restPath, DATASOURCE_GIT_REPOS_DIR, STORAGE_DIR;

describe('/datasource POST', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        DATASOURCE_GIT_REPOS_DIR = global.testParams.DATASOURCE_GIT_REPOS_DIR;
        STORAGE_DIR = global.testParams.STORAGE_DIR;
        restPath = `${restUrl}/datasource`;
    });
    describe('validation', () => {
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
            // @ts-expect-error
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
        it('should throw missing file error', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'my-dataSource',
                },
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(
                "data should have required property 'files'"
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
            const removeDirectoryMock = sinon.fake();
            sinon.replace(fse, 'remove', removeDirectoryMock);
            const { response } = await createDataSource({ body: { name } });

            expect(removeDirectoryMock.getCall(0).firstArg).to.match(
                new RegExp(name)
            );
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
        it('should configure storage for the datasource', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            const config = fse.readFileSync(
                `${DATASOURCE_GIT_REPOS_DIR}/${name}/.dvc/config`,
                'utf8'
            );
            expect(config).to.match(new RegExp(name));
        });
        it('should push to dvc host', async () => {
            const name = uuid();
            await createDataSource({ body: { name } });
            expect(await fse.pathExists(`${STORAGE_DIR}/${name}`)).to.be.true;
        });
        it('should upload a file with meta data', async () => {
            const name = uuid();
            await createDataSource({
                body: { name },
                fileNames: ['logo.svg', 'logo.svg.meta'],
            });
            expect(
                await fse.pathExists(
                    `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/logo.svg`
                )
            ).to.be.true;
            expect(
                await fse.pathExists(
                    `${DATASOURCE_GIT_REPOS_DIR}/${name}/data/logo.svg.meta`
                )
            ).to.be.false;
        });
    });
});
