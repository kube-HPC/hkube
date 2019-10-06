const { expect } = require('chai');
const uuidv4 = require('uuid/v4');
const HttpStatus = require('http-status-codes');
const stateManager = require('../lib/state/state-manager');
const { triggersTree } = require('./mocks');
const { request } = require('./utils');
let restUrl;

describe('Executions', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
    });
    describe('/exec/tree', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/exec/tree`;
        });
        it('pipeline call stack by trigger', async () => {
            let prefix = '57ec5c39-122b-4d7c-bc8f-580ba30df511';
            await Promise.all([
                stateManager.setJobStatus({ jobId: prefix + '.a', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.e', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.e.f', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.g', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.i', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h.j.k.l', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h.j.k.o', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.c.d.h.j.k.p', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.b.m', data: { startTime: Date.now() } }),
                stateManager.setJobStatus({ jobId: prefix + '.a.n', data: { startTime: Date.now() } })
            ]);

            const options = {
                method: 'GET',
                uri: restPath + `/${prefix}.a`
            };
            const response = await request(options);
            expect(response.body).to.deep.equal(triggersTree);
        });
        it('should failed if jobId not found', async () => {
            const options = {
                method: 'GET',
                uri: restPath + `/${uuidv4()}`
            };
            const response = await request(options);
            expect(response.response.statusCode).to.deep.equal(404);
        });
    });
});
