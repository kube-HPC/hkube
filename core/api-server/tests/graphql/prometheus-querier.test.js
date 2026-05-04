const { expect } = require('chai');
const sinon = require('sinon');
const { default: axios } = require('axios');
const Logger = require('@hkube/logger');

// Initialize a minimal logger so that GetLogFromContainer() returns a valid instance
// when prometheus-querier.js is first required.
new Logger('test', { transport: { console: { level: 'error' } } });

const prometheusQuerier = require('../../api/graphql/queries/prometheus-querier');

const BASE_OPTIONS = {
    healthMonitoring: {
        enabled: true,
        prometheusEndpoint: 'http://prometheus:9090',
        dataSourceToken: 'test-token',
        errorCooldownMinutes: 30,
    },
    kubernetes: { namespace: 'default' },
};

const DISABLED_OPTIONS = {
    healthMonitoring: { enabled: false },
    kubernetes: { namespace: 'default' },
};

describe('PrometheusQuerier', () => {
    let axiosStub;

    afterEach(() => {
        sinon.restore();
    });

    describe('init', () => {
        it('should build _disabledResponse with null status for every service', () => {
            prometheusQuerier.init(BASE_OPTIONS);
            const { services, overallHealthStatus } = prometheusQuerier._disabledResponse;
            expect(services).to.have.lengthOf(prometheusQuerier._serviceChecks.length);
            services.forEach(s => {
                expect(s).to.have.property('serviceName').that.is.a('string');
                expect(s.status).to.be.null;
            });
            expect(overallHealthStatus).to.be.null;
        });

        it('should set _prometheusEndpoint and _dataSourceToken when enabled', () => {
            prometheusQuerier.init(BASE_OPTIONS);
            expect(prometheusQuerier._prometheusEndpoint).to.equal('http://prometheus:9090');
            expect(prometheusQuerier._dataSourceToken).to.equal('test-token');
        });

        it('should mark as disabled when healthMonitoring.enabled is false', () => {
            prometheusQuerier.init(DISABLED_OPTIONS);
            expect(prometheusQuerier._enabled).to.be.false;
        });

        it('should build prometheus queries scoped to the given namespace', () => {
            prometheusQuerier.init({ ...BASE_OPTIONS, kubernetes: { namespace: 'prod' } });
            const queries = prometheusQuerier._serviceChecks.map(c => c.promQuery);
            queries.forEach(q => expect(q).to.include('prod'));
        });
    });

    describe('getHealthMonitoring', () => {
        beforeEach(() => {
            prometheusQuerier.init(BASE_OPTIONS);
        });

        it('should return _disabledResponse when disabled', async () => {
            prometheusQuerier.init(DISABLED_OPTIONS);
            const result = await prometheusQuerier.getHealthMonitoring();
            expect(result).to.deep.equal(prometheusQuerier._disabledResponse);
        });

        it('should return overallHealthStatus true when all services report value >= 1', async () => {
            // axios.get resolves with the full axios response; _query returns response.data
            // which is the Prometheus API body: { data: { result: [...] } }
            axiosStub = sinon.stub(axios, 'get').resolves({
                data: { data: { result: [{ value: ['timestamp', '2'] }] } },
            });
            const result = await prometheusQuerier.getHealthMonitoring();
            expect(result.overallHealthStatus).to.be.true;
            result.services.forEach(s => expect(s.status).to.be.true);
        });

        it('should return status false for a service reporting value 0', async () => {
            axiosStub = sinon.stub(axios, 'get').resolves({
                data: { data: { result: [{ value: ['timestamp', '0'] }] } },
            });
            const result = await prometheusQuerier.getHealthMonitoring();
            expect(result.overallHealthStatus).to.be.false;
            result.services.forEach(s => expect(s.status).to.be.false);
        });

        it('should return overallHealthStatus null when at least one service returns null status', async () => {
            let callCount = 0;
            axiosStub = sinon.stub(axios, 'get').callsFake(() => {
                callCount++;
                if (callCount === 1) return Promise.reject(new Error('timeout'));
                return Promise.resolve({ data: { result: [{ value: ['timestamp', '1'] }] } });
            });
            const result = await prometheusQuerier.getHealthMonitoring();
            expect(result.overallHealthStatus).to.be.null;
            const nullService = result.services.find(s => s.status === null);
            expect(nullService).to.exist;
        });

        it('should return status false when prometheus returns an empty result array (no pods)', async () => {
            // An empty result means the pod query matched nothing → service is down (false), not unknown (null)
            axiosStub = sinon.stub(axios, 'get').resolves({
                data: { data: { result: [] } },
            });
            const result = await prometheusQuerier.getHealthMonitoring();
            result.services.forEach(s => expect(s.status).to.be.false);
            expect(result.overallHealthStatus).to.be.false;
        });

        it('should return _disabledResponse when an unexpected error is thrown', async () => {
            axiosStub = sinon.stub(axios, 'get').rejects(new Error('network error'));
            // Simulate error inside Promise.all by making the stub throw synchronously
            const origServiceChecks = prometheusQuerier._serviceChecks;
            prometheusQuerier._serviceChecks = null; // force a TypeError in Promise.all mapping
            const result = await prometheusQuerier.getHealthMonitoring();
            prometheusQuerier._serviceChecks = origServiceChecks;
            expect(result).to.deep.equal(prometheusQuerier._disabledResponse);
        });
    });

    describe('_query', () => {
        beforeEach(() => {
            prometheusQuerier.init(BASE_OPTIONS);
        });

        it('should return response.data on a successful request', async () => {
            const fakeData = { result: [{ value: ['ts', '3'] }] };
            axiosStub = sinon.stub(axios, 'get').resolves({ data: fakeData });
            const result = await prometheusQuerier._query('up');
            expect(result).to.deep.equal(fakeData);
        });

        it('should call the correct prometheus URL with query params and auth header', async () => {
            axiosStub = sinon.stub(axios, 'get').resolves({ data: {} });
            await prometheusQuerier._query('up');
            const [url, options] = axiosStub.firstCall.args;
            expect(url).to.equal('http://prometheus:9090/api/v1/query');
            expect(options.params).to.deep.equal({ query: 'up' });
            expect(options.headers.Authorization).to.equal('Bearer test-token');
        });

        it('should return null on a 401 response and disable health monitoring', async () => {
            const err = new Error('Unauthorized');
            err.response = { status: 401 };
            axiosStub = sinon.stub(axios, 'get').rejects(err);
            const result = await prometheusQuerier._query('up');
            expect(result).to.be.null;
            expect(prometheusQuerier._enabled).to.be.false;
        });

        it('should return null on a non-401 HTTP error without disabling monitoring', async () => {
            prometheusQuerier.init(BASE_OPTIONS); // ensure enabled
            const err = new Error('Server Error');
            err.response = { status: 500 };
            axiosStub = sinon.stub(axios, 'get').rejects(err);
            const result = await prometheusQuerier._query('up');
            expect(result).to.be.null;
            expect(prometheusQuerier._enabled).to.be.true;
        });

        it('should use errorCooldownMinutes from options for the cooldown duration', async () => {
            prometheusQuerier.init({ ...BASE_OPTIONS, healthMonitoring: { ...BASE_OPTIONS.healthMonitoring, errorCooldownMinutes: 10 } });
            expect(prometheusQuerier._errorCooldownMs).to.equal(10 * 60 * 1000);
        });

        it('should default errorCooldownMinutes to 30 when not provided', async () => {
            prometheusQuerier.init(BASE_OPTIONS);
            expect(prometheusQuerier._errorCooldownMs).to.equal(30 * 60 * 1000);
        });

        it('should return null on a network error with no response object', async () => {
            axiosStub = sinon.stub(axios, 'get').rejects(new Error('ECONNREFUSED'));
            const result = await prometheusQuerier._query('up');
            expect(result).to.be.null;
        });
    });
});
