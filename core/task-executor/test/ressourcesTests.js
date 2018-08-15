const { expect } = require('chai');
const { shouldAddJob, _sortWorkers } = require('../lib/reconcile/resources');

describe('resources manager', () => {
    it('should add job only when enough resources', () => {
        const availableResources = {
            node1: {
                requests: {
                    cpu: 0.2,
                    memory: 256
                },
                limits: {
                    cpu: 0.2,
                    memory: 256
                },
                total: {
                    cpu: 7.8,
                    memory: 32768
                },
                ratio: {
                    cpu: 0.025641025641025644,
                    memory: 0.0078125
                },
                free: {
                    cpu: 7.6,
                    memory: 32512
                }
            },
            allNodes: {
                requests: {
                    cpu: 0.2,
                    memory: 256
                },
                limits: {
                    cpu: 0.2,
                    memory: 256
                },
                total: {
                    cpu: 7.8,
                    memory: 32768
                },
                ratio: {
                    cpu: 0.025641025641025644,
                    memory: 0.0078125
                },
                free: {
                    cpu: 7.6,
                    memory: 32512
                }
            }
        };

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 3.5,
                    memory: '0.5Mi'
                },
                limits: {
                    cpu: 7,
                    memory: '1Mi'
                }
            }
        };
        const res = shouldAddJob(jobDetails, availableResources);
        expect(res.shouldAdd).to.be.true;
        expect(res.newResources.allNodes.free.cpu).to.eq(4.1);
        expect(res.newResources.allNodes.free.memory).to.eq(32511.5);
    });

    it('should not add if not enough cpu', () => {
        const availableResources = {
            allNodes: {
                free: {
                    cpu: 3,
                    memory: 32512
                },
                total: {
                    cpu: 10,
                    memory: 32512
                }
            }
        };

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 3.5,
                    memory: '0.5Mi'
                },
                limits: {
                    cpu: 7,
                    memory: '1Mi'
                }
            }
        };
        const res = shouldAddJob(jobDetails, availableResources);
        expect(res.shouldAdd).to.be.false;
    });
    it('should not add if not enough memory', () => {
        const availableResources = {
            allNodes: {
                free: {
                    cpu: 4,
                    memory: 32512
                },
                total: {
                    cpu: 10,
                    memory: 32512
                }
            }
        };

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 3.5,
                    memory: '33000Mi'
                },
                limits: {
                    cpu: 7,
                    memory: '1Mi'
                }
            }
        };
        const res = shouldAddJob(jobDetails, availableResources);
        expect(res.shouldAdd).to.be.false;
    });
    it('should add until no more cpu', () => {
        const availableResources = {
            allNodes: {
                free: {
                    cpu: 12,
                    memory: 32512
                },
                total: {
                    cpu: 20,
                    memory: 32512
                }
            }
        };

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 3.5,
                    memory: '0.5Mi'
                },
                limits: {
                    cpu: 7,
                    memory: '1Mi'
                }
            }
        };
        let res = shouldAddJob(jobDetails, availableResources);
        expect(res.shouldAdd).to.be.true;
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.true;
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.allNodes.free.cpu).to.eq(5);
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.allNodes.free.cpu).to.eq(5);
    });
    it('should add until no more memory', () => {
        const availableResources = {
            allNodes: {
                free: {
                    cpu: 12,
                    memory: 25000
                },
                total: {
                    cpu: 20,
                    memory: 32512
                }
            }
        };

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 1,
                    memory: '10000Mi'
                },
                limits: {
                    cpu: 7,
                    memory: '1'
                }
            }
        };
        let res = shouldAddJob(jobDetails, availableResources);
        expect(res.shouldAdd).to.be.true;
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.true;
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.allNodes.free.cpu).to.eq(10);
        expect(res.newResources.allNodes.free.memory).to.eq(5000);
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.allNodes.free.cpu).to.eq(10);
        expect(res.newResources.allNodes.free.memory).to.eq(5000);
    });
});
describe('utils', () => {
    describe('worker sorter', () => {
        it('should sort paused first', () => {
            const workers = [
                {
                    id: 1,
                    workerPaused: false,
                    workerStatus: 'ready'
                },
                {
                    id: 2,
                    workerPaused: true,
                    workerStatus: 'working'
                },
                {
                    id: 3,
                    workerPaused: true,
                    workerStatus: 'ready'
                },
                {
                    id: 4,
                    workerPaused: false,
                    workerStatus: 'working'
                }
            ];
            const res = workers.slice().sort(_sortWorkers);
            expect(res).to.have.lengthOf(4);
            expect(res[0].id).to.eql(3);
            expect(res[1].id).to.eql(2);
            expect(res[2].id).to.eql(1);
            expect(res[3].id).to.eql(4);
        });
        it('should sort paused first different order', () => {
            const workers = [
                {
                    id: 1,
                    workerPaused: false,
                    workerStatus: 'ready'
                },
                {
                    id: 4,
                    workerPaused: false,
                    workerStatus: 'working'
                },

                {
                    id: 3,
                    workerPaused: true,
                    workerStatus: 'ready'
                },
                {
                    id: 2,
                    workerPaused: true,
                    workerStatus: 'working'
                },
            ];
            const res = workers.slice().sort(_sortWorkers);
            expect(res).to.have.lengthOf(4);
            expect(res[0].id).to.eql(3);
            expect(res[1].id).to.eql(2);
            expect(res[2].id).to.eql(1);
            expect(res[3].id).to.eql(4);
        });
        it('should work with empty list', () => {
            const workers = [];
            const res = workers.slice().sort(_sortWorkers);
            expect(res).to.have.lengthOf(0);
        });
    });
});
