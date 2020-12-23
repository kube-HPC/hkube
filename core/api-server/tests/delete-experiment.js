const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { uid } = require('@hkube/uid');
const storageManager = require('@hkube/storage-manager');
const stateManager = require('../lib/state/state-manager');
const WebhookTypes = require('../lib/webhook/States').Types;
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
        it('should get experiment list', async () => {
            const options1 = {
                uri: restPath,
                body: {
                    name: uid()
                }
            };
            const options2 = {
                uri: restPath,
                body: {
                    name: uid()
                }
            };
            const options3 = {
                uri: restPath,
                body: {
                    name: uid()
                }
            };
            await request(options1);
            await request(options2);
            await request(options3);
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const res = await request(options);
            expect(res.body.length).to.have.greaterThan(2);
        });
        it('should delete experiment with all related data', async () => {
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
            const res = await request(options3);
            const jobId = res.body.jobId;

            // delete experiment
            const options4 = {
                uri: `${restPath}/${experiment}`,
                method: 'DELETE'
            };
            const response = await request(options4);

            const response3 = await storageManager.hkube.list({ jobId });
            const response4 = await storageManager.hkubeResults.list({ jobId });
            const response5 = await storageManager.hkubeMetadata.list({ jobId });
            const response8 = await stateManager._etcd.jobs.results.get({ jobId });
            const response9 = await stateManager._etcd.jobs.status.get({ jobId });
            const response10 = await stateManager._etcd.jobs.tasks.get({ jobId });

            expect(response3).to.have.lengthOf(0);
            expect(response4).to.have.lengthOf(0);
            expect(response5).to.have.lengthOf(0);
            expect(response8).to.be.null;
            expect(response9).to.be.null;
            expect(response10).to.be.null;
            expect(response.body.name).to.equal(experiment);
            expect(response.body.message).to.equal('deleted successfully');
        });
    });
});
