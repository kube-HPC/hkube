const { uid: uuidv4 } = require('@hkube/uid');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
const expect = chai.expect;
const sinon = require('sinon');
const Progress = require('../lib/progress/nodes-progress');
let progress;

describe('Progress', function () {
    beforeEach(() => {
        progress = new Progress({
            getGraphStats: () => [],
            getGraphNodes: () => [],
            getGraphAllNodes: () => [],
            sendProgress: async () => null
        });
    })
    it('should call progress with level silly', function () {
        const jobId = `jobid-${uuidv4()}`;
        const data = { status: 'active' };
        const spy = sinon.spy(progress, "_progress");
        progress.silly({ jobId, status: 'active' })
        const call = spy.getCalls()[0];
        expect(spy.calledOnce).to.equal(true);
        expect(call.args[0]).to.equal('silly');
        expect(call.args[1].jobId).to.equal(jobId);
        expect(call.args[1].status).to.equal(data.status);
    });
    it('should call progress with level debug', function () {
        const jobId = `jobid-${uuidv4()}`;
        const data = { status: 'active' };
        const spy = sinon.spy(progress, "_progress");
        progress.debug({ jobId, status: 'active' })
        const call = spy.getCalls()[0];
        expect(spy.calledOnce).to.equal(true);
        expect(call.args[0]).to.equal('debug');
        expect(call.args[1].jobId).to.equal(jobId);
        expect(call.args[1].status).to.equal(data.status);
    });
    it('should call progress with level info', function () {
        const jobId = `jobid-${uuidv4()}`;
        const data = { status: 'active' };
        const spy = sinon.spy(progress, "_progress");
        progress.info({ jobId, status: 'active' })
        const call = spy.getCalls()[0];
        expect(spy.calledOnce).to.equal(true);
        expect(call.args[0]).to.equal('info');
        expect(call.args[1].jobId).to.equal(jobId);
        expect(call.args[1].status).to.equal(data.status);
    });
    it('should call progress with level warning', function () {
        const jobId = `jobid-${uuidv4()}`;
        const data = { status: 'active' };
        const spy = sinon.spy(progress, "_progress");
        progress.warning({ jobId, status: 'active' })
        const call = spy.getCalls()[0];
        expect(spy.calledOnce).to.equal(true);
        expect(call.args[0]).to.equal('warning');
        expect(call.args[1].jobId).to.equal(jobId);
        expect(call.args[1].status).to.equal(data.status);
    });
    it('should call progress with level error', function () {
        const jobId = `jobid-${uuidv4()}`;
        const data = { status: 'active' };
        const spy = sinon.spy(progress, "_progress");
        progress.error({ jobId, status: 'active' })
        const call = spy.getCalls()[0];
        expect(spy.calledOnce).to.equal(true);
        expect(call.args[0]).to.equal('error');
        expect(call.args[1].jobId).to.equal(jobId);
        expect(call.args[1].status).to.equal(data.status);
    });
    it('should call progress with level critical', function () {
        const jobId = `jobid-${uuidv4()}`;
        const data = { status: 'active' };
        const spy = sinon.spy(progress, "_progress");
        progress.critical({ jobId, status: data.status })
        const call = spy.getCalls()[0];
        expect(spy.calledOnce).to.equal(true);
        expect(call.args[0]).to.equal('critical');
        expect(call.args[1].jobId).to.equal(jobId);
        expect(call.args[1].status).to.equal(data.status);
    });
});