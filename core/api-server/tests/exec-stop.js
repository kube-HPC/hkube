const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
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
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('jobId no_such_id Not Found');
        });
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: { jobId: 'no_such_id' }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('jobId no_such_id Not Found');
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
            expect(response.body.message).to.equal('OK');
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
            expect(response.body.message).to.equal('OK');
        });
        it.only('should throw a "not found" error when no jobs are found within a time frame', async () => {
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
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`No Jobs Found between 2021-03-11T14:30:00 to 2021-04-11T14:30:00`)
        }
        );
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
                    pipelineName: 'flow2'
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
            expect(responsePipeline.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(responsePipeline.body.error.message).to.equal(`No running jobs of ${optionsPipeline.body.pipelineName} to stop`);
        
            expect(responseTimeFrame.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(responseTimeFrame.body.error.message).to.equal(`No running jobs of ${optionsTimeFrame.body.pipelineName} which started between ${optionsTimeFrame.body.startTime.from} to ${optionsTimeFrame.body.startTime.to} to stop`);
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
                    pipelineName: 'flow2'
                }
            };
            const responsePipeline = await request(optionsPipeline);
            expect(responsePipeline.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(responsePipeline.body.error.message).to.equal(`No running jobs of ${optionsPipeline.body.pipelineName} to stop`);
        }); 
    });
});
