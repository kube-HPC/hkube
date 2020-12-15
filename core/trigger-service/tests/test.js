const { expect } = require('chai');
const sinon = require('sinon');
const nock = require('nock');
const { uid: uuidv4 } = require('@hkube/uid');
const storeManager = require('../lib/store/store-manager');
const triggerQueue = require('../lib/queue/trigger-queue');
const pipelineProducer = require('../lib/pipelines/pipeline-producer');
const { cronTrigger, pipelineTrigger } = require('../lib/triggers');
const bootstrap = require('../bootstrap');
const Trigger = require('../lib/triggers/Trigger');
const pipelines = require('./mocks/pipelines.json');
const { Triggers } = require('../lib/consts');
const delay = require('await-delay');

describe('test', () => {
    before(async () => {
        nock('http://localhost:3000').persist().post('/internal/v1/exec/stored/cron').reply(200, { jobId: uuidv4() });
        nock('http://localhost:3000').persist().post('/internal/v1/exec/stored/trigger').reply(200, { jobId: uuidv4() });
        await bootstrap.init();
        await storeManager._db.pipelines.createMany(pipelines);
    });
    describe('CronTrigger', () => {
        beforeEach(() => {
            cronTrigger._crons.clear();
        });
        it('should get cron job map', () => {
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            cronTrigger._updateTrigger(new Trigger(pipeline));
            const cron = cronTrigger._crons.get(pipeline.name);
            expect(cron.pattern).to.equal(pipeline.triggers.cron.pattern);
        });
        it('should not change the cron jobs size when no cron', () => {
            const pipeline = pipelines.find(p => p.name === 'simple');
            storeManager.emit('change', new Trigger(pipeline));
            expect(cronTrigger._crons.size).to.equal(0)
        });
        it('should not change the cron jobs size when same exist cron', () => {
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            storeManager.emit('change', new Trigger(pipeline));
            expect(cronTrigger._crons.size).to.equal(1)
        });
        it('should increase the cron jobs size by one', () => {
            const cron = pipelines.find(p => p.name === 'simple_cron_trigger');
            const pipeline = { ...cron, name: 'new_simple_cron_trigger' };
            storeManager.emit('change', new Trigger(pipeline));
            expect(cronTrigger._crons.size).to.equal(1)
        });
        it('should decrease the cron jobs size when invalid cron pattern', () => {
            const pipeline = pipelines.find(p => p.name === 'invalid_cron_trigger');
            storeManager.emit('change', new Trigger(pipeline));
            expect(cronTrigger._crons.size).to.equal(0)
        });
        it('should run cron job', () => {
            const clock = sinon.useFakeTimers();
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            const spy = sinon.spy(cronTrigger, "_onTick");
            storeManager.emit('change', new Trigger(pipeline));
            clock.tick(1000);
            clock.restore();
            expect(spy.calledOnce).to.equal(true);
            expect(cronTrigger._crons.size).to.equal(1)
        });
    });
    describe('PipelineTrigger', () => {
        it('should trigger 3 pipelines', async () => {
            const result = {
                data: 'data',
                pipeline: 'pipeline_triggered_three',
                jobId: 'jobId'
            }
            const spyAdd = sinon.spy(triggerQueue, "addTrigger");
            const spy = sinon.spy(pipelineTrigger, "_runPipeline");
            storeManager.emit('results', result);
            await delay(1000);

            expect(spy.calledOnce).to.equal(true);
            const triggerCalls = spyAdd.args.filter(x => x[0].name.includes("trigger-"));
            const wasNotCalled = spyAdd.args.filter(x => x[0].name.includes("test-not-called"));
            expect(wasNotCalled.length).to.equal(0);
            expect(triggerCalls.length).to.equal(3);
        });
    });
    describe('PipelineProducer', () => {
        it('should throw error when pass invalid name', (done) => {
            pipelineProducer.produce({ jobId: 'jobId' }).catch(error => {
                expect(error.message).to.equal('invalid name');
                done();
            })
        });
        it('should send http request to api-server', async () => {
            const response = await pipelineProducer.produce({ name: 'name', jobId: 'jobId', type: Triggers.TRIGGER });
            expect(response.body).to.have.property('jobId');
        });
    });
    describe('TriggerQueue', () => {
        it('should throw error when pass invalid name', (done) => {
            triggerQueue.addTrigger({ jobId: 'jobId' }).catch(error => {
                expect(error.message).to.equal('invalid name');
                done();
            })
        });
        it('should send http request to api-server', async () => {
            const response = await triggerQueue.addTrigger({ name: 'name', jobId: 'jobId', type: Triggers.TRIGGER });
            expect(response.body).to.have.property('jobId');
        });
    });
});
