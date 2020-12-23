const { expect } = require('chai');
const querystring = require('querystring');
const HttpStatus = require('http-status-codes');
const { pipelines, workerStub } = require('./mocks');
const { request } = require('./utils');
let restUrl, internalUrl;

describe('Cron', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        internalUrl = global.testParams.internalUrl;
    });
    describe('/cron/results', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/cron/results`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '?name=no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('cron results no_such_id Not Found');
        });
        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ name: 'pipe', order: 'bla' });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of sort property', async () => {
            const qs = querystring.stringify({ name: 'pipe', sort: 'bla' });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.sort should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: 0 });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: "y" });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get cron results', async () => {
            const pipeline = 'flow1';
            const optionsRun = {
                uri: `${internalUrl}/exec/stored/cron`,
                body: {
                    name: pipeline,
                    priority: 2,
                    options: {
                        ttl: 1200,
                        batchTolerance: 90,
                        progressVerbosityLevel: "info"
                    }
                }
            };
            const data = [100, 200, 300];
            const responses = await Promise.all(data.map(d => request(optionsRun)));
            await Promise.all(responses.map((r, i) => workerStub.done({ jobId: r.body.jobId, data: data[i] })));

            const qs = querystring.stringify({ name: pipeline, sort: 'desc', limit: 3 });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            const result = response.body.map(r => r.data).sort();
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(result).to.deep.equal(data);
            expect(response.body[0]).to.have.property('jobId');
            expect(response.body[0]).to.have.property('data');
            expect(response.body[0]).to.have.property('storageModule');
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('timeTook');
            expect(response.body[0]).to.have.property('timestamp');
        })
    });
    describe('/cron/status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/cron/status`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '?name=no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('cron status no_such_id Not Found');
        });

        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ name: 'pipe', order: 'bla' });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of sort property', async () => {
            const qs = querystring.stringify({ name: 'pipe', sort: 'bla' });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.sort should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: 0 });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ name: 'pipe', limit: "y" });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get cron status', async () => {
            const pipeline = 'flow1';
            const optionsRun = {
                uri: `${internalUrl}/exec/stored/cron`,
                body: {
                    name: pipeline
                }
            };
            const limit = 3;
            await Promise.all(Array.from(Array(limit)).map(d => request(optionsRun)));

            const qs = querystring.stringify({ name: pipeline, sort: 'desc', limit });
            const options = {
                uri: `${restPath}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body[0]).to.have.property('jobId');
            expect(response.body[0]).to.have.property('level');
            expect(response.body[0]).to.have.property('pipeline');
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('timestamp');
        })
    });
    describe('/cron/start', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/cron/start`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'no_such_name'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline no_such_name Not Found');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`data should have required property 'name'`);
        });
        it('should throw validation error of invalid cron', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'simple',
                    pattern: 'no_such'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`data.pattern should match format "cron"`);
        });
        it('should success to start cron', async () => {
            const pipeline = pipelines.find(p => p.name === 'trigger-cron-disabled');
            const pattern = "* * * * *";
            const options1 = {
                uri: restPath,
                body: {
                    name: pipeline.name,
                    pattern
                }
            };
            const options2 = {
                uri: `${restUrl}/store/pipelines/${pipeline.name}`,
                method: 'GET'
            };
            const response1 = await request(options1);
            const response2 = await request(options2);
            expect(response1.body.message).to.equal('OK');
            expect(response2.body.triggers.cron.enabled).to.equal(true);
            expect(response2.body.triggers.cron.pattern).to.equal(pattern);
        });
        it('should success to start cron with default pattern', async () => {
            const pipeline = pipelines.find(p => p.name === 'trigger-no-cron');
            const options1 = {
                uri: restPath,
                body: {
                    name: pipeline.name,
                }
            };
            const options2 = {
                uri: `${restUrl}/store/pipelines/${pipeline.name}`,
                method: 'GET'
            };
            const response1 = await request(options1);
            const response2 = await request(options2);
            expect(response1.body.message).to.equal('OK');
            expect(response2.body.triggers.cron.enabled).to.equal(true);
            expect(response2.body.triggers.cron.pattern).to.equal('0 * * * *');
        });
    });
    describe('/cron/stop', () => {
        let restPath = null;
        let method = 'POST';
        before(() => {
            restPath = `${restUrl}/cron/stop`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'no_such_name'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('pipeline no_such_name Not Found');
        });
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                method
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(`data should have required property 'name'`);
        });
        it('should success to stop cron', async () => {
            const pipeline = pipelines.find(p => p.name === 'trigger-cron-enabled');
            const options1 = {
                uri: restPath,
                body: { name: pipeline.name }
            };
            const options2 = {
                uri: `${restUrl}/store/pipelines/${pipeline.name}`,
                method: 'GET'
            };
            const response1 = await request(options1);
            const response2 = await request(options2);
            expect(response1.body.message).to.equal('OK');
            expect(response2.body.triggers.cron.enabled).to.equal(false);
            expect(response2.body.triggers.cron.pattern).to.equal(pipeline.triggers.cron.pattern);
        });
    });
});
