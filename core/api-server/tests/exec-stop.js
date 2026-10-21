const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const sinon = require('sinon');
const { STMConflictError } = require('etcd3');
const { pipelineStatuses } = require('@hkube/consts');
const stateManager = require('../lib/state/state-manager');
const { request } = require('./utils');
let restUrl;

describe('Executions', function () {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/stop', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/stop`;
        });
        it('should throw validation error of jobId Not Found', async () => {
            const options = {
                uri: restPath,
                body: { jobId: 'no_such_id' }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal(`No jobs found matching criteria (jobId: ${options.body.jobId}, statuses: ${pipelineStatuses.ACTIVE},${pipelineStatuses.PENDING},${pipelineStatuses.PAUSED})`);
        });
        it('should succeed to stop jobs without startTime filter', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow1' }
            };
            const stored = await request(optionsStored);
            const optionsStop = {
                uri: restPath,
                body: { jobId: stored.body.jobId }
            };
            const response = await request(optionsStop);
            expect(response.body.error).to.not.exist;
            expect(response.body.stoppedJobIds).to.be.an('array');
            expect(response.body.stoppedJobIds).to.include(stored.body.jobId);
        });
        it('should succeed to stop jobs with startTime filter', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow2' }
            };
            const stored = await request(optionsStored);

            const currentDate = new Date();
            const previousDay = new Date(currentDate);
            previousDay.setDate(currentDate.getDate() - 1);
            const nextDay = new Date(currentDate);
            nextDay.setDate(currentDate.getDate() + 1);

            const fromDateString = previousDay.toISOString();
            const toDateString = nextDay.toISOString();
            const optionsStop = {
                uri: restPath,
                body: {
                    jobId: stored.body.jobId,
                    pipelineName: 'flow2',
                    startTime: {
                        from: fromDateString,
                        to: toDateString
                    }
                }
            };
            const response = await request(optionsStop);
            expect(response.body.error).to.not.exist;
            expect(response.body.stoppedJobIds).to.be.an('array');
            expect(response.body.stoppedJobIds).to.include(stored.body.jobId);
        });
        it('should throw a "not found" error when no jobs are found within a time frame', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow2' }
            };
            const stored = await request(optionsStored);
            const optionsStop = {
                uri: restPath,
                body: {
                    startTime: {
                        from: "2021-03-11T14:30:00",
                        to: "2021-04-11T14:30:00"
                    }
                }
            };
            const response = await request(optionsStop);
            expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal(`No jobs found matching criteria (datesRange: 2021-03-11T14:30:00 to 2021-04-11T14:30:00, statuses: ${pipelineStatuses.ACTIVE},${pipelineStatuses.PENDING},${pipelineStatuses.PAUSED})`);
        });
        it('should throw a "not found" error when no jobs of a certain pipeline are found within a time frame', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: {
                    name: 'flow1',
                }
            };
            const stored = await request(optionsStored);
            const optionsPipeline = {
                uri: restPath,
                body: {
                    pipelineName: 'flow3'
                }
            };
            const optionsTimeFrame = {
                uri: restPath,
                body: {
                    pipelineName: 'flow1',
                    startTime: {
                        from: "2021-03-11T14:30:00",
                        to: "2021-04-11T14:30:00"
                    }
                }
            };

            // Send both requests
            const responsePipeline = await request(optionsPipeline);
            const responseTimeFrame = await request(optionsTimeFrame);

            // Check if both responses contain a "not found" error
            expect(responsePipeline.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(responsePipeline.body.error.message).to.equal(`No jobs found matching criteria (pipelineName: ${optionsPipeline.body.pipelineName}, statuses: ${pipelineStatuses.ACTIVE},${pipelineStatuses.PENDING},${pipelineStatuses.PAUSED})`);

            expect(responseTimeFrame.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(responseTimeFrame.body.error.message).to.equal(`No jobs found matching criteria (pipelineName: ${optionsTimeFrame.body.pipelineName}, datesRange: ${optionsTimeFrame.body.startTime.from} to ${optionsTimeFrame.body.startTime.to}, statuses: ${pipelineStatuses.ACTIVE},${pipelineStatuses.PENDING},${pipelineStatuses.PAUSED})`);
        });
        it('should throw a "not found" error when no jobs of a certain pipeline are found', async () => {
            const optionsStored = {
                uri: restUrl + '/exec/stored',
                body: { name: 'flow1' }
            };
            const stored = await request(optionsStored);
            const optionsPipeline = {
                uri: restPath,
                body: {
                    pipelineName: 'flow4'
                }
            };
            const responsePipeline = await request(optionsPipeline);
            expect(responsePipeline.body.error.code).to.equal(HttpStatus.StatusCodes.NOT_FOUND);
            expect(responsePipeline.body.error.message).to.equal(`No jobs found matching criteria (pipelineName: ${optionsPipeline.body.pipelineName}, statuses: ${pipelineStatuses.ACTIVE},${pipelineStatuses.PENDING},${pipelineStatuses.PAUSED})`);
        });
        it('should run stop jobs with statusToStop as a comma-separated string', async () => {
            const optionsStop = {
                uri: restUrl + '/exec/stop',
                body: { statusToStop: `${pipelineStatuses.DEQUEUED},${pipelineStatuses.CRASHED}` }
            };
            const response = await request(optionsStop);
            expect(response.body.error.message).to.equal(`No jobs found matching criteria (statuses: ${pipelineStatuses.DEQUEUED},${pipelineStatuses.CRASHED})`);
        });
        it('should stop jobs with statusToStop as a single string', async () => {
            const optionsStop = {
                uri: restUrl + '/exec/stop',
                body: { statusToStop: `${pipelineStatuses.ACTIVE}` }
            };
            const response = await request(optionsStop);
            expect(response.body.error.message).to.equal(`No jobs found matching criteria (statuses: ${pipelineStatuses.ACTIVE})`);
        });
        it('should stop jobs with statusToStop as an array', async () => {
            const optionsStop = {
                uri: restUrl + '/exec/stop',
                body: { statusToStop: [pipelineStatuses.ACTIVE, pipelineStatuses.RESUMED], pipelineName: 'flow30' }
            };
            const response = await request(optionsStop);
            expect(response.body.error.message).to.equal(`No jobs found matching criteria (pipelineName: ${optionsStop.body.pipelineName}, statuses: ${pipelineStatuses.ACTIVE},${pipelineStatuses.RESUMED})`);
        });
        describe('etcd STM conflict on job status update', () => {
            let originalOptions;
            before(() => {
                originalOptions = stateManager._options.jobStatusUpdate;
                stateManager._options.jobStatusUpdate = { conflictRetries: 3, conflictRetryDelay: 5 };
            });
            after(() => {
                stateManager._options.jobStatusUpdate = originalOptions;
            });
            afterEach(() => {
                sinon.restore();
            });
            const runStored = async () => {
                const stored = await request({ uri: restUrl + '/exec/stored', body: { name: 'flow1' } });
                return stored.body.jobId;
            };
            it('should retry and stop the job when etcd status update conflicts', async () => {
                const jobId = await runStored();
                const statusApi = stateManager._etcd.jobs.status;
                const original = statusApi.update.bind(statusApi);
                const stub = sinon.stub(statusApi, 'update');
                stub.onCall(0).rejects(new STMConflictError());
                stub.onCall(1).rejects(new STMConflictError());
                stub.callsFake(original);
                const response = await request({ uri: restPath, body: { jobId } });
                expect(response.body.error).to.not.exist;
                expect(response.body.stoppedJobIds).to.include(jobId);
                expect(stub.callCount).to.equal(3);
                const status = await stateManager._etcd.jobs.status.get({ jobId });
                expect(status.status).to.equal(pipelineStatuses.STOPPED);
            });
            it('should fail after exhausting conflict retries', async () => {
                const jobId = await runStored();
                const stub = sinon.stub(stateManager._etcd.jobs.status, 'update').rejects(new STMConflictError());
                const response = await request({ uri: restPath, body: { jobId } });
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR);
                expect(stub.callCount).to.equal(4);
            });
            it('should not retry on non-conflict etcd errors', async () => {
                const jobId = await runStored();
                const stub = sinon.stub(stateManager._etcd.jobs.status, 'update').rejects(new Error('etcd unavailable'));
                const response = await request({ uri: restPath, body: { jobId } });
                expect(response.body.error.code).to.equal(HttpStatus.StatusCodes.INTERNAL_SERVER_ERROR);
                expect(stub.callCount).to.equal(1);
            });
        });
    });
});
