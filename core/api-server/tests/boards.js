const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
const { boardStatuses } = require('@hkube/consts');
const graphAdapter = require('../lib/state/graph-adapter');
const graph = require('./mocks/graph.json');

let restUrl;

describe('Boards', () => {
    before(() => {
        restUrl = global.testParams.restUrl + '/boards/tensor';
    });
    describe('status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + 'no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('board {"id":"no_such_id"} Not Found');
        });
    });
    describe('start', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/`;
        });
        it('starting task board should succeed', async () => {
            const options1 = {
                uri: global.testParams.restUrl + '/exec/raw',
                body: {
                    name: 'exec_pipeline',
                    nodes: [
                        {
                            nodeName: 'nName',
                            algorithmName: 'green-alg',
                            input: [],
                            metrics: { tensorboard: true }
                        }
                    ]
                }
            };
            const response1 = await request(options1);
            await graphAdapter.setGraph({ key: response1.body.jobId, data: graph });
            let options = {
                uri: restPath,
                method: 'POST',
                body: {
                    jobId: response1.body.jobId,
                    taskId: 'A:eval-alg:8c36cd08-a440-46c7-bc8f-57a477b3a4da'
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/${response.body.id}`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.status).to.equal(boardStatuses.PENDING);
        });
        it('starting task board should fail if no such task', async () => {
            const options1 = {
                uri: global.testParams.restUrl + '/exec/raw',
                body: {
                    name: 'exec_pipeline',
                    nodes: [
                        {
                            nodeName: 'nName',
                            algorithmName: 'green-alg',
                            input: [],
                            metrics: { tensorboard: true }
                        }
                    ]
                }
            };
            const response1 = await request(options1);
            await graphAdapter.setGraph({ key: response1.body.jobId, data: graph });
            let options = {
                uri: restPath,
                method: 'POST',
                body: {
                    jobId: response1.body.jobId,
                    taskId: 'no_such_task'
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`No task no_such_task in job ${response1.body.jobId} undefined Not Found`);
        });
        it('starting node board should succeed', async () => {
            let options = {
                uri: `${restUrl}`,
                method: 'POST',
                body: {
                    pipelineName: 'pName',
                    nodeName: 'node',
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/${response.body.id}`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.status).to.equal(boardStatuses.PENDING);
        });

        it('starting board should fail if name exists', async () => {
            const options1 = {
                uri: global.testParams.restUrl + '/exec/raw',
                body: {
                    name: 'exec_pipeline',
                    nodes: [
                        {
                            nodeName: 'nName',
                            algorithmName: 'green-alg',
                            input: [],
                            metrics: { tensorboard: true }
                        }
                    ]
                }
            };
            const response1 = await request(options1);
            const options = {
                uri: restPath,
                method: 'POST',
                body: {
                    pipelineName: 'adfb',
                    nodeName: 'nodedd',
                    jobId: response1.body.jobId,
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('board: already started');
        });
        it('starting board should fail if no such job', async () => {
            const options = {
                uri: restPath,
                method: 'POST',
                body: {
                    pipelineName: 'adfb',
                    nodeName: 'nodedd',
                    jobId: 'no_such_job',
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline no_such_job Not Found');
        });


    });
    describe('stop', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}`;
        });
        it('should throw NotFound when board does not exist on stop board', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('board {"id":"no_such_id"} Not Found');
        });

        it('should succeed to stop', async () => {
            let options = {
                uri: `${restUrl}`,
                method: 'POST',
                body: {
                    pipelineName: 'pName1',
                    nodeName: 'node',
                }
            };
            let response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: restPath + '/' + response.body.id,
                method: 'DELETE'
            };
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            options = {
                uri: `${restUrl}/${response.body.id}`,
                method: 'GET'
            }
            response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.NOT_FOUND);
        });

    });
});
