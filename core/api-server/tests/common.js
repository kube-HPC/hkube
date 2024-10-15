const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { uid: uuid } = require('@hkube/uid');
const { Factory } = require('@hkube/redis-utils');
const swagger = require('../api/rest-api/swagger.json');
const { request } = require('./utils');
const httpMethods = ['GET', 'POST', 'PUT', 'DELETE'];
const stateManager = require('../lib/state/state-manager');
let updater, restUrl, redisClient;
const redis = {
    host: process.env.REDIS_SERVICE_HOST || 'localhost',
    port: process.env.REDIS_SERVICE_PORT || 6379,
    sentinel: false
};
describe('Common', () => {
    before(() => {
        updater = require('../lib/examples/pipelines-updater');
        restUrl = global.testParams.restUrl;
    });
    describe('Pipeline template', () => {
        it('should apply defaults', async () => {
            await updater._pipelineDriversTemplate({});
            const template = await stateManager._db.pipelineDrivers.fetchAll();
            expect(template[0]).to.exist;
            expect(template[0].mem).to.eql(2048);
            expect(template[0].cpu).to.eql(0.15);
        });
        it('should apply from config', async () => {
            await updater._pipelineDriversTemplate({ pipelineDriversResources: { mem: 300, cpu: 0.6 } });
            const template = await stateManager._db.pipelineDrivers.fetchAll();
            expect(template[0]).to.exist;
            expect(template[0].mem).to.eql(300);
            expect(template[0].cpu).to.eql(0.6);
        });
    });
    describe('migrate graph', () => {
        before(() => {
            redisClient = Factory.getClient(redis);
        });
        it('should move graph from redis to db', async () => {
            const jobId1 = uuid();
            const job1 = {
                jobId: jobId1,
                graph: {
                    jobId: jobId1,
                    timestamp: Date.now
                },
                status: {
                    good: true
                }
            };
            await stateManager._db.jobs.create(job1);
            const jobId2 = uuid();
            const job2 = {
                jobId: jobId2,
                status: {
                    bad: true
                }
            };
            const graph2 = {
                jobId: jobId2,
                timestamp: Date.now()
            };
            await stateManager._db.jobs.create(job2);
            await redisClient.set(`/hkube:pipeline:graph/${jobId2}`, JSON.stringify(graph2));

            const redisGraph = await redisClient.get(`/hkube:pipeline:graph/${jobId2}`);
            expect(redisGraph).to.eql(JSON.stringify(graph2));
            const job2Before = await stateManager._db.jobs.fetch({ jobId: jobId2 });
            expect(job2Before.graph).to.not.exist;
            await updater._transferGraphsToDB({ redis });
            const redisGraph2 = await redisClient.get(`/hkube:pipeline:graph/${jobId2}`);
            expect(redisGraph2).to.not.exist;
            const job2After = await stateManager._db.jobs.fetch({ jobId: jobId2 });
            expect(job2After.graph).to.eql(graph2);
        });
    });
    describe('Method Not Allowed', () => {
        Object.entries(swagger.paths).forEach(([k, v]) => {
            it(`${k} - should throw Method Not Allowed`, async () => {
                const keys = Object.keys(v).map((m) => m.toUpperCase());
                const methods = httpMethods.filter((h) => !keys.includes(h));
                const method = methods[0];
                const uri = `${restUrl}${k}`;
                const options = {
                    method,
                    uri,
                    body: {}
                };
                const response = await request(options);
                if (response.body.error && response.body.error.code === HttpStatus.StatusCodes.METHOD_NOT_ALLOWED) {
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.METHOD_NOT_ALLOWED);
                    expect(response.body.error.message).to.equal('Method Not Allowed');
                }
            });
        });
    });
    describe('should NOT have additional properties', () => {
        Object.entries(swagger.paths).forEach(([k, v]) => {
            it(`${k} - should NOT have additional properties`, async () => {
                const method = Object.keys(v)
                    .map((m) => m.toUpperCase())
                    .find((m) => m === 'POST');
                if (!method) {
                    return;
                }
                const content = v.post.requestBody && v.post.requestBody.content['application/json'];
                if (!content || content.additionalProperties || (content.schema && !content.schema.hasOwnProperty('additionalProperties'))) {
                    return;
                }
                const uri = `${restUrl}${k}`;
                const options = {
                    method,
                    uri,
                    body: {
                        no_such_prop: 'bla'
                    }
                };
                const response = await request(options);
                if (response.body.error && response.body.error.code === HttpStatus.StatusCodes.BAD_REQUEST) {
                    expect(response.body).to.have.property('error');
                    expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.BAD_REQUEST);
                }
            });
        });
    });
});
