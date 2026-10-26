const { expect } = require('chai');
const sinon = require('sinon');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { stateType } = require('@hkube/consts');
const AutoScaler = require('../lib/streaming/services/auto-scaler');

const config = configIt.load().main.streaming.autoScaler;
const ROUND_TRIP_REASON = 'Based on round trip and predicted queue size';
const FIRST_SCALE_REASON = 'Based on config file, when starting';

describe('auto-scaler stateless limits intervention log', () => {
    let fakeLog;
    let autoScaler;

    const interventionLogs = () => fakeLog.info.getCalls()
        .map(c => c.args[0])
        .filter(m => m.includes('intervention'));

    const createAutoScaler = ({ min, max } = {}) => {
        autoScaler = new AutoScaler({
            nodeName: 'node-a',
            jobId: 'job-id',
            config,
            node: { algorithmName: 'alg-a', stateType: stateType.Stateless, minStatelessCount: min, maxStatelessCount: max }
        }, () => { });
        return autoScaler;
    };

    const capBoth = (required, reason = ROUND_TRIP_REASON) => autoScaler._capScaleByLimits(required, autoScaler._limitActionType.both, reason);

    beforeEach(() => {
        fakeLog = {
            info: sinon.stub(),
            debug: sinon.stub(),
            warning: sinon.stub(),
            error: sinon.stub(),
            throttle: { info: sinon.stub(), warning: sinon.stub(), error: sinon.stub() }
        };
        sinon.stub(Logger, 'GetLogFromContainer').returns(fakeLog);
    });

    afterEach(() => {
        autoScaler?.finish();
        autoScaler = null;
        sinon.restore();
    });

    it('should not log when required is within limits', () => {
        createAutoScaler({ min: 2, max: 10 });
        [2, 5, 7, 10].forEach((required) => {
            expect(capBoth(required)).to.equal(required);
        });
        expect(interventionLogs()).to.have.lengthOf(0);
    });

    it('should not log when no limits are defined', () => {
        createAutoScaler();
        [1, 5, 100].forEach((required) => {
            expect(capBoth(required)).to.equal(required);
        });
        expect(interventionLogs()).to.have.lengthOf(0);
    });

    it('should cap by max and log the final value', () => {
        createAutoScaler({ min: 2, max: 10 });
        expect(capBoth(20)).to.equal(10);
        const logs = interventionLogs();
        expect(logs).to.have.lengthOf(1);
        expect(logs[0]).to.equal(`scaling bothLimits intervention, node node-a: required 20 -> 10 (min 2, max 10). ${ROUND_TRIP_REASON}`);
    });

    it('should raise to min and log the final value', () => {
        createAutoScaler({ min: 4 });
        expect(capBoth(1)).to.equal(4);
        const logs = interventionLogs();
        expect(logs).to.have.lengthOf(1);
        expect(logs[0]).to.equal(`scaling bothLimits intervention, node node-a: required 1 -> 4 (min 4). ${ROUND_TRIP_REASON}`);
    });

    it('should log once for fixed-size node (min = max) across ticks', () => {
        createAutoScaler({ min: 15, max: 15 });
        [5, 6, 5, 7, 3, 5, 20, 15, 5].forEach((required) => {
            expect(capBoth(required)).to.equal(15);
        });
        const logs = interventionLogs();
        expect(logs).to.have.lengthOf(1);
        expect(logs[0]).to.equal(`scaling bothLimits intervention, node node-a: required 5 -> 15 (min 15, max 15). ${ROUND_TRIP_REASON}`);
    });

    it('should log again only when decision or reason changes', () => {
        createAutoScaler({ min: 2, max: 10 });
        capBoth(20);
        capBoth(30);
        capBoth(1);
        capBoth(0);
        capBoth(1, FIRST_SCALE_REASON);
        expect(interventionLogs()).to.have.lengthOf(3);
    });

    it('should log again after reset', () => {
        createAutoScaler({ min: 15, max: 15 });
        capBoth(5);
        autoScaler.reset();
        capBoth(5);
        expect(interventionLogs()).to.have.lengthOf(2);
    });

    it('should log only on actual cap for single-limit types', () => {
        createAutoScaler({ min: 2, max: 10 });
        const { maxStateless, minStateless } = autoScaler._limitActionType;
        expect(autoScaler._capScaleByLimits(5, maxStateless)).to.equal(5);
        expect(autoScaler._capScaleByLimits(5, minStateless)).to.equal(5);
        expect(interventionLogs()).to.have.lengthOf(0);
        expect(autoScaler._capScaleByLimits(12, maxStateless)).to.equal(10);
        expect(autoScaler._capScaleByLimits(1, minStateless)).to.equal(2);
        const logs = interventionLogs();
        expect(logs).to.have.lengthOf(2);
        expect(logs[0]).to.contain('required 12 -> 10 (max 10)');
        expect(logs[1]).to.contain('required 1 -> 2 (min 2)');
    });

    it('should log once per metrics tick stream for fixed-size node and still update required', () => {
        createAutoScaler({ min: 15, max: 15 });
        [100, 120, 90, 110].forEach((reqRate) => {
            autoScaler._getScaleDetails({ reqRate, totalRequests: 100, totalResponses: 100, queueSize: 0, currentSize: 15, roundTripTimeMs: [20] });
        });
        expect(autoScaler._scaler.required).to.equal(15);
        expect(interventionLogs()).to.have.lengthOf(1);
    });
});
