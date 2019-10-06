const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { workerStub } = require('./mocks');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/results', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/results`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('status no_such_id Not Found');
        });
        it('should throw validation error of required property execution id', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'jobId'");
        });
        it('should succeed to get results', async () => {
            const optionsRun = {
                uri: restUrl + '/exec/raw',
                body: {
                    name: 'exec_raw_results',
                    nodes: [
                        {
                            nodeName: 'string',
                            algorithmName: 'green-alg',
                            input: []
                        }
                    ]
                }
            };
            const responseRun = await request(optionsRun);
            const jobId = responseRun.body.jobId;
            const data = 500;
            await workerStub.done({ jobId, data });

            const options = {
                uri: restPath + `/${responseRun.body.jobId}`,
                method: 'GET'
            };
            const response = await request(options);

            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.data).to.equal(data);
            expect(response.body).to.have.property('jobId');
            expect(response.body).to.have.property('data');
            expect(response.body).to.have.property('storageModule');
            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('timeTook');
            expect(response.body).to.have.property('timestamp');
        });
    });
});
