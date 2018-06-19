const { expect } = require('chai');
const { shouldAddJob } = require('../lib/reconcile/resources');

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
                    cpu: 8,
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
        expect(res.newResources.allNodes.free.cpu).to.eq(1);
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.allNodes.free.cpu).to.eq(1);
    });
    it('should add until no more memory', () => {
        const availableResources = {
            allNodes: {
                free: {
                    cpu: 8,
                    memory: 25000
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
        expect(res.newResources.allNodes.free.cpu).to.eq(6);
        expect(res.newResources.allNodes.free.memory).to.eq(5000);
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.allNodes.free.cpu).to.eq(6);
        expect(res.newResources.allNodes.free.memory).to.eq(5000);
    });
});
