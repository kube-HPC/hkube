const { expect } = require('chai');
const sinon = require('sinon');

const RECONCILERS = ['_algorithmBuilds', '_tensorboards', '_optunaboards', '_algorithmDebug', '_algorithmQueue', '_algorithmGateways', '_pipelineDriversHandle'];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

describe('operator reconcile loop', () => {
    let Operator, kubernetes, db, log, options;
    let sandbox;

    before(() => {
        Operator = require('../lib/operator').constructor;
        kubernetes = global.testParams.kubernetesMock;
        db = require('../lib/helpers/db');
        log = require('@hkube/logger').GetLogFromContainer();
        options = global.testParams.config;
    });
    beforeEach(() => {
        sandbox = sinon.createSandbox();
        sandbox.stub(kubernetes, 'getVersionsConfigMap').resolves({ versions: {}, registry: {}, clusterOptions: {} });
        sandbox.stub(db, 'getAlgorithmTemplates').resolves({ algorithms: [], count: 0 });
    });
    afterEach(() => {
        sandbox.restore();
    });

    // Fresh instance whose reconcilers are stubbed. `next` replaces the bound _interval,
    // and setTimeout scheduling of `next` is captured instead of really scheduled.
    const createOperator = (overrides = {}) => {
        const op = new Operator();
        op._intervalMs = 1000;
        op._lastReconcileSuccessTime = 0;
        RECONCILERS.forEach((name) => {
            op[name] = overrides[name] || sandbox.stub().resolves();
        });
        const scheduled = [];
        op._interval = () => { };
        const realSetTimeout = global.setTimeout;
        sandbox.stub(global, 'setTimeout').callsFake((fn, ms, ...args) => {
            if (fn === op._interval) {
                scheduled.push({ at: Date.now(), ms });
                return null;
            }
            return realSetTimeout(fn, ms, ...args);
        });
        const run = () => Operator.prototype._interval.call(op, options);
        return { op, run, scheduled };
    };

    it('should schedule next cycle only after all reconcilers settled, even when one fails fast', async () => {
        let slowDoneAt;
        const { run, scheduled } = createOperator({
            _algorithmGateways: sandbox.stub().rejects(new Error('getServices timeout')),
            _pipelineDriversHandle: async () => {
                await delay(100);
                slowDoneAt = Date.now();
            }
        });
        await run();
        expect(scheduled).to.have.lengthOf(1);
        expect(slowDoneAt).to.be.a('number');
        expect(scheduled[0].at).to.be.at.least(slowDoneAt);
        expect(scheduled[0].ms).to.eql(1000);
    });
    it('should run all reconcilers even when some fail', async () => {
        const { op, run } = createOperator({
            _algorithmBuilds: sandbox.stub().rejects(new Error('a')),
            _tensorboards: sandbox.stub().rejects(new Error('b'))
        });
        await run();
        RECONCILERS.forEach((name) => {
            expect(op[name].calledOnce, name).to.eql(true);
        });
    });
    it('should log each failed reconciler', async () => {
        const errorSpy = sandbox.spy(log.throttle, 'error');
        const { run } = createOperator({
            _algorithmBuilds: sandbox.stub().rejects(new Error('builds broke')),
            _algorithmGateways: sandbox.stub().rejects(new Error('gateways broke'))
        });
        await run();
        const messages = errorSpy.getCalls().map(c => c.args[0]);
        expect(messages).to.include('reconcile algorithmBuilds failed: builds broke');
        expect(messages).to.include('reconcile algorithmGateways failed: gateways broke');
    });
    it('should handle reconciler that throws synchronously', async () => {
        const { op, run, scheduled } = createOperator({
            _algorithmBuilds: () => { throw new Error('sync'); }
        });
        await run();
        expect(scheduled).to.have.lengthOf(1);
        expect(op._lastReconcileSuccessTime).to.be.above(0);
    });
    it('should update last reconcile success when pipeline drivers succeed, even if others fail', async () => {
        const { op, run } = createOperator({
            _tensorboards: sandbox.stub().rejects(new Error('boards'))
        });
        const before = Date.now();
        await run();
        expect(op._lastReconcileSuccessTime).to.be.at.least(before);
    });
    it('should not update last reconcile success when pipeline drivers fail', async () => {
        const { op, run, scheduled } = createOperator({
            _pipelineDriversHandle: sandbox.stub().rejects(new Error('getPipelineDriversJobs timeout'))
        });
        await run();
        expect(op._lastReconcileSuccessTime).to.eql(0);
        expect(scheduled).to.have.lengthOf(1);
    });
    it('should not update last reconcile success and still schedule next cycle when config fetch fails', async () => {
        kubernetes.getVersionsConfigMap.rejects(new Error('getVersionsConfigMap timeout'));
        const { op, run, scheduled } = createOperator();
        await run();
        expect(op._lastReconcileSuccessTime).to.eql(0);
        expect(op._pipelineDriversHandle.called).to.eql(false);
        expect(scheduled).to.have.lengthOf(1);
    });

    describe('checkHealth', () => {
        const healthOperator = ({ interval = 0, board = 0, reconcile = 0 } = {}) => {
            const op = new Operator();
            const now = Date.now();
            op._lastIntervalTime = now - interval;
            op._lastIntervalBoardTime = now - board;
            op._lastReconcileSuccessTime = now - reconcile;
            return op;
        };
        it('should be healthy when loops tick and reconcile succeeded recently', () => {
            expect(healthOperator({ reconcile: 1000 }).checkHealth(30000, 120000)).to.eql(true);
        });
        it('should be unhealthy when no successful reconcile within reconcileMaxDiff', () => {
            expect(healthOperator({ reconcile: 130000 }).checkHealth(30000, 120000)).to.eql(false);
        });
        it('should be unhealthy when interval loop did not tick within maxDiff', () => {
            expect(healthOperator({ interval: 40000 }).checkHealth(30000, 120000)).to.eql(false);
        });
        it('should be unhealthy when boards loop did not tick within maxDiff', () => {
            expect(healthOperator({ board: 40000 }).checkHealth(30000, 120000)).to.eql(false);
        });
        it('should skip reconcile check when reconcileMaxDiff is not set', () => {
            expect(healthOperator({ reconcile: 130000 }).checkHealth(30000)).to.eql(true);
        });
        it('should be healthy before loops started', () => {
            const op = new Operator();
            expect(op.checkHealth(30000, 120000)).to.eql(true);
        });
        it('should count startup as reference for reconcile success', async () => {
            const op = new Operator();
            sandbox.stub(op, '_interval');
            sandbox.stub(op, '_boardsInterval');
            sandbox.stub(op, '_prepareDriversData').returns({});
            const before = Date.now();
            await op.init({ ...options, isDevMode: false });
            expect(op._lastReconcileSuccessTime).to.be.at.least(before);
        });
    });
});
