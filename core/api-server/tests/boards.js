const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
const States = require('../lib/state/States')
let restUrl;

describe('Boards', () => {
    before(() => {
        restUrl = global.testParams.restUrl + '/boards/tensor';
    });
    describe('status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/status`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('board no_such_id Not Found');
        });
    });
    describe('start', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/start`;
        });
        it('should throw validation error of bad board name', async () => {
            const options = {
                uri: restPath + '/f*dd',
                method: 'POST',
                body: {
                    metricLinks: ['adf']
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('board name must not contain special characters *,&#$ or spaces');
        });
        it('check metricLinks mandatory validation', async () => {
            const options = {
                uri: restPath + '/boardName',
                method: 'POST',
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'metricLinks'");
        });
        it('starting board should succeed', async () => {
            let options = {
                uri: restPath + '/myBoard',
                method: 'POST',
                body: {
                    metricLinks: ['adf']
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/status/myBoard`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.name).to.equal('myBoard');
            expect(response.body.status).to.equal(States.PENDING);
        });
        it('starting board should fail if name exists', async () => {
            const options = {
                uri: restPath + '/myUniqueBoard',
                method: 'POST',
                body: {
                    metricLinks: ['adf']
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('board myUniqueBoard already started');
        });
    });
    describe('stop', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/stop`;
        });
        it('should throw NotFound when board does not exist on stop board', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'PUT'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('board no_such_id Not Found');
        });

        it('should succeed to stop', async () => {
            let options = {
                uri: restUrl + '/start/jobToStop',
                method: 'POST',
                body: {
                    metricLinks: ['adf']
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: restPath + '/jobToStop',
                method: 'PUT'
            };
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/status/jobToStop`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.status).to.equal(States.STOPPED);
        });

    });
});
