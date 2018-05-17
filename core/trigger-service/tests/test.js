const { expect } = require('chai');
const sinon = require('sinon');
const mockery = require('mockery');
const bootstrap = require('../bootstrap');
let storedPipelineListener, cronTrigger, pipelineTrigger, stateManager;
const Trigger = require('../lib/triggers/Trigger');
const pipelines = require('./mocks/pipelines.json');

const stubTask = {
    name: 'stub',
    triggers: {
        cron: '*/1 * * * *'
    }
};

describe('test', () => {
    before(async () => {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: false,
            warnOnUnregistered: false
        });

        mockery.registerSubstitute('../state/state-manager', `${process.cwd()}/tests/mocks/state-manager.js`);
        mockery.registerSubstitute('../lib/state/state-manager', `${process.cwd()}/tests/mocks/state-manager.js`);

        await bootstrap.init();

        storedPipelineListener = require('../lib/pipelines/stored-pipelines-listener');
        cronTrigger = require('../lib/triggers/index').cronTrigger;
        pipelineTrigger = require('../lib/triggers/index').pipelineTrigger;
        stateManager = require('../lib/state/state-manager');

    });
    describe('CronTrigger', () => {
        it('should get cron job map ', () => {
            cronTrigger._updateTrigger(new Trigger(stubTask));
            const cron = cronTrigger._crons.get(stubTask.name);
            expect(cron.cronTime.source).to.equal(stubTask.triggers.cron);
        });
        it('should get array of pipelines by cron type', async () => {
            const pipelines = await storedPipelineListener.getTriggeredPipelineByType('cron');
            expect(pipelines).to.be.an('array');
        });
        it('should get array of pipelines by pipelines type', async () => {
            const pipelines = await storedPipelineListener.getTriggeredPipelineByType('pipelines');
            expect(pipelines).to.be.an('array');
        });
        it('should get array of pipelines by pipelines type', async () => {
            const pipeline = pipelines.find(p => p.name === 'simple');
            stateManager.emit('change', pipeline);
            expect(cronTrigger._crons.size).to.equal(2)
        });
        it('should get array of pipelines by pipelines type', async () => {
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            stateManager.emit('change', pipeline);
            expect(cronTrigger._crons.size).to.equal(2)
        });
        it('should get array of pipelines by pipelines type', async () => {
            const pipeline = pipelines.find(p => p.name === 'simple_cron_trigger');
            stateManager.emit('delete', pipeline);
            expect(cronTrigger._crons.size).to.equal(1)
        });
        it('should get array of pipelines by pipelines type', async () => {
            const pipeline = pipelines.find(p => p.name === 'invalid_cron_trigger');
            stateManager.emit('change', pipeline);
            expect(cronTrigger._crons.size).to.equal(1)
        });
    });
    describe('PipelineTrigger', () => {
        it('should get array of pipelines by pipelines type', async () => {
            const pipeline = pipelines.find(p => p.name === 'simple_pipelines_trigger');
            const result = {
                data: 'data',
                pipeline: 'pipeline',
                jobId: 'jobId'
            }
            const spy = sinon.spy(pipelineTrigger, "_runPipeline");
            stateManager.emit('result-change', result, pipeline);
            expect(spy.calledOnce).to.equal(true);
        });
    });
});
