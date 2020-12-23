const { expect } = require('chai');
const fse = require('fs-extra');
const HttpStatus = require('http-status-codes');
const { algorithms, pipelines } = require('./mocks');
const { request } = require('./utils');
let restUrl;

describe('ReadMe', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/pipelines', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/readme/pipelines`;
        });
        it('should throw validation error of readme Not Found', async () => {
            const options = {
                method: 'GET',
                uri: `${restPath}/${pipelines[0].name}`
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`readme ${pipelines[0].name} Not Found`);
        });
        it('should success to insert readme', async () => {
            const uri = `${restPath}/${pipelines[0].name}`;
            const file = 'tests/mocks/README-1.md';
            const readme = fse.readFileSync(file, 'UTF-8');
            const options1 = {
                uri,
                formData: {
                    'README.md': fse.createReadStream(file)
                }
            };
            const response1 = await request(options1);
            expect(response1.body).to.eql({ message: 'OK' });
            expect(response1.response.statusCode).to.equal(HttpStatus.CREATED);

            const options2 = {
                uri,
                method: 'GET',
            };
            const response2 = await request(options2);
            expect(response2.body).to.have.property('name');
            expect(response2.body).to.have.property('readme');
            expect(response2.body.readme).to.equal(readme);
        });
        it('should success to update readme', async () => {
            const uri = `${restPath}/${pipelines[0].name}`;
            const file1 = 'tests/mocks/README-1.md';
            const file2 = 'tests/mocks/README-2.md';
            const readme = fse.readFileSync(file2, 'UTF-8');

            const insert = {
                uri,
                method: 'POST',
                formData: {
                    'README.md': fse.createReadStream(file1)
                }
            };
            const response1 = await request(insert);
            expect(response1.body).to.eql({ message: 'OK' });
            expect(response1.response.statusCode).to.equal(HttpStatus.CREATED);

            const put = {
                uri,
                method: 'PUT',
                formData: { 'README.md': fse.createReadStream(file2) }
            };
            const response2 = await request(put);
            expect(response2.body).to.eql({ message: 'OK' });
            expect(response2.response.statusCode).to.equal(HttpStatus.OK);

            const get = {
                uri,
                method: 'GET'
            };
            const response3 = await request(get);
            expect(response3.body).to.have.property('name');
            expect(response3.body).to.have.property('readme');
            expect(response3.body.readme).to.equal(readme);
        });
        it('should success to delete readme', async () => {
            const uri = `${restPath}/${pipelines[0].name}`;
            const file = 'tests/mocks/README-1.md';
            const insert = {
                uri,
                method: 'POST',
                formData: {
                    'README.md': fse.createReadStream(file)
                }
            };
            const response1 = await request(insert);
            expect(response1.body).to.eql({ message: 'OK' });
            expect(response1.response.statusCode).to.equal(HttpStatus.CREATED);

            const options2 = {
                uri,
                method: 'DELETE'
            };
            const response2 = await request(options2);
            expect(response2.body).to.have.property('message');
            expect(response2.body.message).to.equal('OK');

            const get = {
                uri,
                method: 'GET'
            };
            const response3 = await request(get);
            expect(response3.body).to.have.property('error');
            expect(response3.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response3.body.error.message).to.equal(`readme ${pipelines[0].name} Not Found`);

        });
    });
    describe('/algorithms', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/readme/algorithms`;
        });
        it('should throw validation error of readme Not Found', async () => {
            const options = {
                method: 'GET',
                uri: `${restPath}/${algorithms[0].name}`
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`readme ${algorithms[0].name} Not Found`);
        });
        it('should success to insert readme', async () => {
            const uri = `${restPath}/${algorithms[0].name}`;
            const file = 'tests/mocks/README-1.md';
            const readme = fse.readFileSync(file, 'UTF-8');
            const options1 = {
                uri,
                formData: {
                    'README.md': fse.createReadStream(file)
                }
            };
            const response1 = await request(options1);
            expect(response1.body).to.eql({ message: 'OK' });
            expect(response1.response.statusCode).to.equal(HttpStatus.CREATED);

            const options2 = {
                uri,
                method: 'GET',
            };
            const response2 = await request(options2);
            expect(response2.body).to.have.property('name');
            expect(response2.body).to.have.property('readme');
            expect(response2.body.readme).to.equal(readme);
        });
        it('should success to update readme', async () => {
            const uri = `${restPath}/${algorithms[0].name}`;
            const file1 = 'tests/mocks/README-1.md';
            const file2 = 'tests/mocks/README-2.md';
            const readme = fse.readFileSync(file2, 'UTF-8');

            const insert = {
                uri,
                method: 'POST',
                formData: {
                    'README.md': fse.createReadStream(file1)
                }
            };
            const response1 = await request(insert);
            expect(response1.body).to.eql({ message: 'OK' });
            expect(response1.response.statusCode).to.equal(HttpStatus.CREATED);

            const put = {
                uri,
                method: 'PUT',
                formData: { 'README.md': fse.createReadStream(file2) }
            };
            const response2 = await request(put);
            expect(response2.body).to.eql({ message: 'OK' });
            expect(response2.response.statusCode).to.equal(HttpStatus.OK);

            const get = {
                uri,
                method: 'GET'
            };
            const response3 = await request(get);
            expect(response3.body).to.have.property('name');
            expect(response3.body).to.have.property('readme');
            expect(response3.body.readme).to.equal(readme);
        });
        it('should success to delete readme', async () => {
            const uri = `${restPath}/${algorithms[0].name}`;
            const file = 'tests/mocks/README-1.md';
            const insert = {
                uri,
                method: 'POST',
                formData: {
                    'README.md': fse.createReadStream(file)
                }
            };
            const response1 = await request(insert);
            expect(response1.body).to.eql({ message: 'OK' });
            expect(response1.response.statusCode).to.equal(HttpStatus.CREATED);

            const options2 = {
                uri,
                method: 'DELETE'
            };
            const response2 = await request(options2);
            expect(response2.body).to.have.property('message');
            expect(response2.body.message).to.equal('OK');

            const get = {
                uri,
                method: 'GET'
            };
            const response3 = await request(get);
            expect(response3.body).to.have.property('error');
            expect(response3.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response3.body.error.message).to.equal(`readme ${algorithms[0].name} Not Found`);
        });
    });
});
