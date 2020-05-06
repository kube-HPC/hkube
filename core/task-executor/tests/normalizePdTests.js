const { expect } = require('chai');
const { normalizeDrivers, normalizeDriversRequests, normalizeDriversJobs, mergeWorkers, normalizeResources } = require('../lib/reconcile/normalize');
const { twoCompleted } = require('./stub/jobsRaw');
const { workersStub, jobsStub } = require('./stub/normalizedStub');
const { nodes, pods } = require('./stub/resources');

describe('normalize pipeline driver', () => {
    describe('normalize jobs', () => {
        it('should work with no jobs', () => {
            const jobsRaw = {};
            const res = normalizeDriversJobs(jobsRaw);
            expect(res).to.be.empty;
        });
        it('should work with undefined', () => {
            const res = normalizeDriversJobs();
            expect(res).to.be.empty;
        });
        it('should ignore completed jobs', () => {
            const res = normalizeDriversJobs(twoCompleted, j => !j.status.succeeded);
            expect(res).to.have.lengthOf(2);
        });
        it('should ignore active jobs', () => {
            const res = normalizeDriversJobs(twoCompleted, j => j.status.succeeded);
            expect(res).to.have.lengthOf(2);
        });
        it('should ignore completed and failed jobs', () => {
            const res = normalizeDriversJobs(twoCompleted, j => (!j.status.succeeded && !j.status.failed));
            expect(res).to.have.lengthOf(1);
        });
        it('should return all jobs', () => {
            const res = normalizeDriversJobs(twoCompleted);
            expect(res).to.have.lengthOf(4);
        });
    });
    describe('normalize drivers', () => {
        it('should work with empty drivers array', () => {
            const drivers = [];
            const res = normalizeDrivers(drivers);
            expect(res).to.be.empty;
        });
        it('should work with undefined drivers array', () => {
            const res = normalizeDrivers();
            expect(res).to.be.empty;
        });
        it('should return object with ids', () => {
            const drivers = [
                {
                    driverId: 'id1',
                    driverStatus: 'ready',
                    error: null
                },
                {
                    driverId: 'id2',
                    driverStatus: 'not-ready',
                    error: null
                },
                {
                    driverId: 'id3',
                    driverStatus: 'notready',
                    error: null
                }
            ];
            const res = normalizeDrivers(drivers);
            expect(res).to.have.length(3);
            expect(res).to.deep.include({
                id: 'id1',
                driverStatus: 'ready',
                paused: false,
                podName: undefined
            });
            expect(res).to.deep.include({
                id: 'id2',
                driverStatus: 'not-ready',
                paused: false,
                podName: undefined
            });
            expect(res).to.deep.include({
                id: 'id3',
                driverStatus: 'notready',
                paused: false,
                podName: undefined
            });
        });
    });
    describe('normalize requests', () => {
        it('should work with empty requests array', () => {
            const res = normalizeDriversRequests([]);
            expect(res).to.be.empty;
        });
        it('should work with undefined requests array', () => {
            const res = normalizeDriversRequests();
            expect(res).to.be.empty;
        });
        it('should return object with requests per algorithms', () => {
            const stub = [
                {
                    data: [
                        {
                            name: 'pipeline-driver',
                        },
                        {
                            name: 'pipeline-driver',
                        },
                        {
                            name: 'pipeline-driver',
                        }

                    ]
                }
            ];
            const res = normalizeDriversRequests(stub);
            expect(res).to.have.length(1);
            expect(res).to.deep.include({
                name: 'pipeline-driver',
                pods: 3
            });
        });
    });
    describe('normalize resources', () => {
        it('should work with empty resources array', () => {
            const res = normalizeResources({});
            expect(res.allNodes.ratio.cpu).to.eq(0);
            expect(res.allNodes.ratio.gpu).to.eq(0);
            expect(res.allNodes.ratio.memory).to.eq(0);
        });
        it('should work with undefined resources array', () => {
            const res = normalizeResources();
            expect(res.allNodes.ratio.cpu).to.eq(0);
            expect(res.allNodes.ratio.gpu).to.eq(0);
            expect(res.allNodes.ratio.memory).to.eq(0);
        });
        it('should return resources by node and totals', () => {
            const res = normalizeResources({ pods, nodes });
            expect(res.allNodes.total.cpu).to.eq(23.4);
            expect(res.allNodes.total.gpu).to.eq(8);
            expect(res.allNodes.total.memory).to.eq(98304);
            expect(res.nodeList[0].requests.cpu).to.eq(0.2);
            expect(res.nodeList[1].requests.cpu).to.eq(0.25);
            expect(res.nodeList[2].requests.cpu).to.eq(0);
            expect(res.nodeList[0].requests.gpu).to.eq(1);
            expect(res.nodeList[1].requests.gpu).to.eq(2);
            expect(res.nodeList[2].requests.gpu).to.eq(0);
        });
        it('should return resources free resources by node', () => {
            const res = normalizeResources({ pods, nodes });
            expect(res.allNodes.free.cpu).to.eq(22.95);
            expect(res.allNodes.free.gpu).to.eq(5);
            expect(res.allNodes.free.memory).to.eq(97664);
            expect(res.nodeList[0].free.cpu).to.eq(7.6);
            expect(res.nodeList[1].free.cpu).to.eq(7.55);
            expect(res.nodeList[2].free.cpu).to.eq(7.8);
            expect(res.nodeList[0].free.gpu).to.eq(3);
            expect(res.nodeList[1].free.gpu).to.eq(2);
            expect(res.nodeList[2].free.gpu).to.eq(0);
        });
    });
});
