const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
let storedPipelineListener, cronTrigger, pipelineTrigger, triggerQueue, pipelineProducer, storeManager;
const Trigger = require('../lib/triggers/Trigger');
const pipelines = require('./mocks/pipelines.json');
const apiServerMock = require('./mocks/api-server');
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);

describe('test', () => {
    before(async () => {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: false,
            warnOnUnregistered: false
        });

        mockery.registerSubstitute('../store/store-manager', `${process.cwd()}/tests/mocks/store-manager.js`);
        mockery.registerSubstitute('../lib/store/store-manager', `${process.cwd()}/tests/mocks/store-manager.js`);

        triggerQueue = require('../lib/queue/trigger-queue');
        triggerRunner = require('../lib/queue/trigger-runner');
        storedPipelineListener = require('../lib/pipelines/stored-pipelines-listener');
        pipelineProducer = require('../lib/pipelines/pipeline-producer');
        cronTrigger = require('../lib/triggers/index').cronTrigger;
        pipelineTrigger = require('../lib/triggers/index').pipelineTrigger;
        storeManager = require('../lib/store/store-manager');

        await apiServerMock.init();
        cronTrigger.init(main);
        triggerRunner.init(main);
        storedPipelineListener.init(main);
        pipelineProducer.init(main);
    });
    describe('CronTrigger', () => {
        beforeEach(() => {
            cronTrigger._crons.clear();
        });
        it('should get cron job map', () => {
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            cronTrigger._updateTrigger(new Trigger(pipeline));
            const cron = cronTrigger._crons.get(pipeline.name);
            expect(cron.cronTime.source).to.equal(pipeline.triggers.cron);
        });
        it('should get array of pipelines by cron type', async () => {
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            const pipelinesList = await storedPipelineListener.getTriggeredPipelineByType('cron');
            expect(pipelinesList).to.be.an('array');
            expect(pipelinesList[0]).to.deep.equal(new Trigger(pipeline));
        });
        it('should get array of pipelines by pipelines type', async () => {
            const pipeline = pipelines.find(p => p.name === 'simple_pipelines_trigger');
            const pipelinesList = await storedPipelineListener.getTriggeredPipelineByType('pipelines');
            expect(pipelinesList).to.be.an('array');
            expect(pipelinesList[0]).to.deep.equal(new Trigger(pipeline));
        });
        it('should not change the cron jobs size when no cron', () => {
            const pipeline = pipelines.find(p => p.name === 'simple');
            storeManager.emit('change', pipeline);
            expect(cronTrigger._crons.size).to.equal(0)
        });
        it('should not change the cron jobs size when same exist cron', () => {
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            storeManager.emit('change', pipeline);
            expect(cronTrigger._crons.size).to.equal(1)
        });
        it('should increase the cron jobs size by one', () => {
            const cron = pipelines.find(p => p.name === 'simple_cron_trigger');
            const pipeline = { ...cron, name: 'new_simple_cron_trigger' };
            storeManager.emit('change', pipeline);
            expect(cronTrigger._crons.size).to.equal(1)
        });
        it('should decrease the cron jobs size by one', () => {
            const cron = pipelines.find(p => p.name === 'simple_cron_trigger');
            const pipeline = { ...cron, name: 'new_simple_cron_trigger' };
            storeManager.emit('change', pipeline);
            storeManager.emit('delete', pipeline);
            expect(cronTrigger._crons.size).to.equal(0)
        });
        it('should decrease the cron jobs size when invalid cron pattern', () => {
            const pipeline = pipelines.find(p => p.name === 'invalid_cron_trigger');
            storeManager.emit('change', pipeline);
            expect(cronTrigger._crons.size).to.equal(0)
        });
        it('should run cron job', () => {
            const clock = sinon.useFakeTimers();
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            const spy = sinon.spy(cronTrigger, "_onTick");
            storeManager.emit('change', pipeline);
            clock.tick(1000);
            clock.restore();
            expect(spy.calledOnce).to.equal(true);
            expect(cronTrigger._crons.size).to.equal(1)
        });
    });
    describe('PipelineTrigger', () => {
        it('should trigger another pipeline', () => {
            const pipeline = pipelines.find(p => p.name === 'simple_pipelines_trigger');
            const result = {
                data: 'data',
                pipeline: 'pipeline',
                jobId: 'jobId'
            }
            const spy = sinon.spy(pipelineTrigger, "_runPipeline");
            storeManager.emit('result-change', result, pipeline);
            expect(spy.calledOnce).to.equal(true);
        });
    });
    describe('PipelineProducer', () => {
        it('should throw error when pass invalid name', (done) => {
            pipelineProducer.produce({ jobId: 'jobId' }).catch(error => {
                expect(error.message).to.equal('invalid name');
                done();
            })
        });
        it('should throw error when pass invalid jobId', (done) => {
            pipelineProducer.produce({ name: 'name' }).catch(error => {
                expect(error.message).to.equal('invalid jobId');
                done();
            })
        });
        it('should send http request to api-server', async () => {
            const response = await pipelineProducer.produce({ name: 'name', jobId: 'jobId' });
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
        it('should throw error when pass invalid jobId', (done) => {
            triggerQueue.addTrigger({ name: 'name' }).catch(error => {
                expect(error.message).to.equal('invalid jobId');
                done();
            })
        });
        it('should send http request to api-server', async () => {
            const response = await triggerQueue.addTrigger({ name: 'name', jobId: 'jobId' });
            expect(response.body).to.have.property('jobId');
        });
    });
});
