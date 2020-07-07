const { expect } = require('chai');
const { nodeSelectorFilter, shouldAddJob } = require('../lib/reconcile/resources');
const { settings: globalSettings } = require('../lib/helpers/settings');

describe('resources manager', () => {

    it('should add job only when enough resources', () => {
        const availableResources = {
            node: {
                requests: {
                    cpu: 0.2,
                    gpu: 2,
                    memory: 256
                },
                limits: {
                    cpu: 0.2,
                    gpu: 2,
                    memory: 256
                },
                total: {
                    cpu: 7.8,
                    gpu: 4,
                    memory: 32768
                },
                ratio: {
                    cpu: 0.025641025641025644,
                    gpu: 0.5,
                    memory: 0.0078125
                },
                free: {
                    cpu: 7.6,
                    gpu: 2,
                    memory: 32512
                }
            }
        };
        const nodeList = [];
        nodeList.push({ name: 'node', ...availableResources.node });
        availableResources.nodeList = nodeList;

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 3.5,
                    'nvidia.com/gpu': 1,
                    memory: '0.5Mi'
                },
                limits: {
                    cpu: 7,
                    'nvidia.com/gpu': 1,
                    memory: '1Mi'
                }
            }
        };
        const res = shouldAddJob(jobDetails, availableResources);
        expect(res.shouldAdd).to.be.true;
        expect(res.newResources.node.free.cpu).to.eq(4.1);
        expect(res.newResources.node.free.gpu).to.eq(1);
        expect(res.newResources.node.free.memory).to.eq(32511.5);
    });
    it('should not add if not enough cpu', () => {
        const availableResources = {
            node: {
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
        const nodeList = [];
        nodeList.push({ name: 'node', ...availableResources.node });
        availableResources.nodeList = nodeList;

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
            node: {
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
        const nodeList = [];
        nodeList.push({ name: 'node', ...availableResources.node });
        availableResources.nodeList = nodeList;

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
            node: {
                free: {
                    cpu: 12,
                    gpu: 4,
                    memory: 32512
                },
                total: {
                    cpu: 20,
                    gpu: 8,
                    memory: 32512
                }
            }
        };
        const nodeList = [];
        nodeList.push({ name: 'node', ...availableResources.node });
        availableResources.nodeList = nodeList;

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 3.5,
                    'nvidia.com/gpu': 1,
                    memory: '0.5Mi'
                },
                limits: {
                    cpu: 7,
                    'nvidia.com/gpu': 1,
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
        expect(res.newResources.node.free.cpu).to.eq(5);
        expect(res.newResources.node.free.gpu).to.eq(2);
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.node.free.cpu).to.eq(5);
        expect(res.newResources.node.free.gpu).to.eq(2);
    });
    it('should add until no more memory', () => {
        const availableResources = {
            node: {
                free: {
                    cpu: 12,
                    gpu: 4,
                    memory: 25000
                },
                total: {
                    cpu: 20,
                    gpu: 8,
                    memory: 32512
                }
            }
        };
        const nodeList = [];
        nodeList.push({ name: 'node', ...availableResources.node });
        availableResources.nodeList = nodeList;

        const jobDetails = {
            algorithmName: 'green-alg',
            algorithmImage: 'hkube/algorithm-example',
            workerImage: 'hkube/worker',
            resourceRequests: {
                requests: {
                    cpu: 1,
                    'nvidia.com/gpu': 1,
                    memory: '10000Mi'
                },
                limits: {
                    cpu: 7,
                    'nvidia.com/gpu': 1,
                    memory: '1'
                }
            }
        };
        let res = shouldAddJob(jobDetails, availableResources);
        expect(res.shouldAdd).to.be.true;
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.node.free.cpu).to.eq(11);
        expect(res.newResources.node.free.gpu).to.eq(3);
        expect(res.newResources.node.free.memory).to.eq(15000);
        res = shouldAddJob(jobDetails, res.newResources);
        expect(res.shouldAdd).to.be.false;
        expect(res.newResources.node.free.cpu).to.eq(11);
        expect(res.newResources.node.free.gpu).to.eq(3);
        expect(res.newResources.node.free.memory).to.eq(15000);
    });
});
describe('nodeSelectorFilter', () => {
    it('should pass with no labels and no nodeSelector', () => {
        const labels = null;
        const nodeSelector = null;
        const res = nodeSelectorFilter(labels, nodeSelector);
        expect(res).to.equal(true);
    });
    it('should pass with no labels and nodeSelector', () => {
        const labels = null;
        const nodeSelector = {
            "disktype": "ssd-1",
            "gpu": "gpu-1"
        };
        const res = nodeSelectorFilter(labels, nodeSelector);
        expect(res).to.equal(false);
    });
    it('should pass with labels and no nodeSelector', () => {
        const labels = {
            "disktype": "no-ssd",
            "gpu": "gpu-1"
        };
        const nodeSelector = null;
        const res = nodeSelectorFilter(labels, nodeSelector);
        expect(res).to.equal(true);
    });
    it('should failed with different labels and nodeSelector', () => {
        const labels = {
            "disktype": "no-ssd",
            "gpu": "gpu-1"
        };
        const nodeSelector = {
            "disktype": "ssd-1",
            "gpu": "gpu-1"
        };
        const res = nodeSelectorFilter(labels, nodeSelector);
        expect(res).to.equal(false);
    });
    it('should pass with same labels and nodeSelector', () => {
        const labels = {
            "disktype": "ssd-1",
            "gpu": "gpu-1"
        };
        const nodeSelector = {
            "disktype": "ssd-1",
            "gpu": "gpu-1"
        };
        const res = nodeSelectorFilter(labels, nodeSelector);
        expect(res).to.equal(true);
    });
});
