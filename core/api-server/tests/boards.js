const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
const { boardStatuses } = require('@hkube/consts');
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
            expect(response.body.error.message).to.equal('board {"taskId":"no_such_id"} Not Found');
        });
    });
    describe('start', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/start`;
        });
        it('check mandatory nodeName validation', async () => {
            const options = {
                uri: restPath + '/board-name',
                method: 'POST',
                body: {
                    pipelineName: 'adf',
                    jobId: 'jobbb',
                    taskId: 'taskIDDD'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'nodeName'");
        });
        it('starting task board should succeed', async () => {
            let options = {
                uri: restPath + '/taskIDDD',
                method: 'POST',
                body: {
                    pipelineName: 'adf',
                    nodeName: 'nodedd',
                    jobId: 'jobbb',
                    taskId: 'taskIDDD'
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/status/taskIDDD`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.status).to.equal(boardStatuses.PENDING);
        });
        it.only('starting batch board should succeed', async () => {
            let options = {
                uri: `${restUrl}/node/nName/start/taskIDDD`,
                method: 'POST',
                body: {
                    pipelineName: 'pName'
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/node/nName/status/taskIDDD`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.status).to.equal(boardStatuses.PENDING);
        });

        it('starting board should fail if name exists', async () => {
            const options = {
                uri: restPath + '/my-unique-board',
                method: 'POST',
                body: {
                    pipelineName: 'adf',
                    nodeName: 'nodedd',
                    jobId: 'jobbb',
                    taskId: 'taskIDDD'
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('board: already started');
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
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('board {"taskId":"no_such_id"} Not Found');
        });

        it('should succeed to stop', async () => {
            let options = {
                uri: restUrl + '/start/job-to-stop',
                method: 'POST',
                body: {
                    pipelineName: 'adf',
                    nodeName: 'nodedd',
                    jobId: 'jobbb',
                    taskId: 'taskIDDD'
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: restPath + '/job-to-stop',
                method: 'DELETE'
            };
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/status/job-to-stop`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.NOT_FOUND);
        });

    });
});
