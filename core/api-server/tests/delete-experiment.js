const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');
let restUrl;

describe('Experiment', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('delete /experiment', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/experiment`;
        });
        it('should fail to delete main experiment', async () => {
            const options = {
                uri: restPath + '/main',
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('main experiment cannot be deleted');
        });
        it('should delete experiment with all releted data', async () => {
            const pipeline = 'pipeline';
            const experiment = 'experimentWithRelations';
            // add experiment
            const options1 = {
                uri: restPath,
                body: {
                    name: experiment
                }
            };
            await request(options1);

            // store pipeline
            const options2 = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: pipeline,
                    experimentName: experiment,
                    nodes: [{
                        nodeName: 'green-alg',
                        algorithmName: 'green-alg',
                    }],
                    triggers: {
                        cron: {
                            enabled: true
                        }
                    }
                }
            };
            await request(options2);

            // run stored
            const options3 = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: pipeline
                }
            };
            await request(options3);

            // delete experiment
            const options4 = {
                uri: `${restPath}/${experiment}`,
                method: 'DELETE'
            };
            const response = await request(options4);
            expect(response.body.name).to.equal(experiment);
            expect(response.body.message).to.equal('deleted successfully');

        });
    });
});
