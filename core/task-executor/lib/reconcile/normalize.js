const sumBy = require('lodash.sumby');
const parse = require('@hkube/units-converter');
const objectPath = require('object-path');

/**
 * normalizes the worker info from discovery
 * input will look like:
 * <code>
 * {
 *  '/discovery/workers/worker-uuid':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      },
 *  '/discovery/workers/worker-uuid2':{
 *      algorithmName,
 *      workerStatus,
 *      jobStatus,
 *      error
 *      }
 * }
 * </code>
 * normalized output should be:
 * <code>
 * {
 *   worker-uuid:{
 *     algorithmName,
 *     workerStatus // ready, working
 * 
 *   }
 * }
 * </code>
 * @param {*} workers 
 */

const normalizeWorkers = (workers) => {
    if (workers == null) {
        return [];
    }
    const workersArray = Object.entries(workers).map(([k, v]) => {
        const workerId = k.match(/([^/]*)\/*$/)[0];
        return {
            id: workerId,
            algorithmName: v.algorithmName,
            workerStatus: v.workerStatus,
            workerPaused: !!v.workerPaused,
            podName: v.podName
        };
    });
    return workersArray;
};


const normalizeDrivers = (drivers) => {
    if (drivers == null) {
        return [];
    }
    const workersArray = Object.entries(drivers).map(([k, v]) => {
        const workerId = k.match(/([^/]*)\/*$/)[0];
        return {
            id: workerId,
            status: v.status,
            paused: !!v.paused,
            podName: v.podName
        };
    });
    return workersArray;
};

const calcRatioFree = (node) => {
    node.ratio = {
        cpu: node.requests.cpu / node.total.cpu,
        memory: node.requests.memory / node.total.memory,
    };
    node.free = {
        cpu: node.total.cpu - node.requests.cpu,
        memory: node.total.memory - node.requests.memory,
    };
};

const normalizeResources = ({ pods, nodes } = {}) => {
    if (!pods || !nodes) {
        return {
            allNodes: {
                ratio: {
                    cpu: 0,
                    memory: 0
                },
                free: {
                    cpu: 0,
                    memory: 0
                }
            }
        };
    }
    const initial = nodes.body.items.reduce((acc, cur) => {
        acc[cur.metadata.name] = {
            requests: { cpu: 0, memory: 0 },
            limits: { cpu: 0, memory: 0 },
            total: {
                cpu: parse.getCpuInCore(cur.status.allocatable.cpu),
                memory: parse.getMemoryInMi(cur.status.allocatable.memory)
            }
        };
        return acc;
    }, {});
    const allNodes = {
        requests: { cpu: 0, memory: 0 },
        limits: { cpu: 0, memory: 0 },
        total: {
            cpu: sumBy(Object.values(initial), 'total.cpu'),
            memory: sumBy(Object.values(initial), 'total.memory'),
        }
    };
    const stateFilter = p => p.status.phase === 'Running' || p.status.phase === 'Pending';
    const resourcesPerNode = pods.body.items.filter(stateFilter).reduce((accumulator, pod) => {
        const { nodeName } = pod.spec;
        if (!nodeName) {
            return accumulator;
        }
        const requestCpu = sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.requests.cpu', '0m')));
        const requestMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.requests.memory', 0)));
        const limitsCpu = sumBy(pod.spec.containers, c => parse.getCpuInCore(objectPath.get(c, 'resources.limits.cpu', '0m')));
        const limitsMem = sumBy(pod.spec.containers, c => parse.getMemoryInMi(objectPath.get(c, 'resources.limits.memory', 0)));

        accumulator[nodeName].requests.cpu += requestCpu;
        accumulator[nodeName].requests.memory += requestMem;
        accumulator[nodeName].limits.cpu += limitsCpu;
        accumulator[nodeName].limits.memory += limitsMem;
        return accumulator;
    }, initial);

    const nodeList = [];
    Object.entries(resourcesPerNode).forEach(([k, v]) => {
        calcRatioFree(v);
        allNodes.requests.cpu += v.requests.cpu;
        allNodes.requests.memory += v.requests.memory;
        allNodes.limits.cpu += v.limits.cpu;
        allNodes.limits.memory += v.limits.memory;
        nodeList.push({ name: k, ...v });
    });
    calcRatioFree(allNodes);
    return { allNodes, nodeList };
};

const normalizeRequests = (requests) => {
    if (requests == null || requests.length === 0 || requests[0].data == null) {
        return [];
    }

    return requests[0].data.map(r => ({ algorithmName: r.name }));
};

const normalizeDriversRequests = (requests) => {
    if (requests == null || requests.length === 0 || requests[0].data == null) {
        return [];
    }
    return [{
        name: 'pipeline-driver',
        pods: requests[0].data.filter(r => r.name === 'pipeline-driver').length
    }];
};

const _tryParseTime = (timeString) => {
    if (!timeString) {
        return null;
    }
    try {
        const date = new Date(timeString);
        return date.getTime();
    }
    catch (error) {
        return null;
    }
};

const normalizeJobs = (jobsRaw, predicate = () => true) => {
    if (!jobsRaw || !jobsRaw.body || !jobsRaw.body.items) {
        return [];
    }
    const jobs = jobsRaw.body.items
        .filter(predicate)
        .map(j => ({
            name: j.metadata.name,
            algorithmName: j.metadata.labels['algorithm-name'],
            active: j.status.active === 1,
            startTime: _tryParseTime(j.status.startTime)
        }));
    return jobs;
};

const normalizeDriversJobs = (jobsRaw, predicate = () => true) => {
    if (!jobsRaw || !jobsRaw.body || !jobsRaw.body.items) {
        return [];
    }
    const jobs = jobsRaw.body.items
        .filter(predicate)
        .map(j => ({
            name: j.metadata.name,
            active: j.status.active === 1
        }));
    return jobs;
};

const mergeWorkers = (workers, jobs) => {
    const foundJobs = [];
    const mergedWorkers = workers.map((w) => {
        const jobForWorker = jobs.find(j => w.podName && w.podName.startsWith(j.name));
        if (jobForWorker) {
            foundJobs.push(jobForWorker.name);
        }
        return { ...w, job: jobForWorker ? { ...jobForWorker } : undefined };
    });

    const extraJobs = jobs.filter((job) => {
        return !foundJobs.find(j => j === job.name);
    });
    return { mergedWorkers, extraJobs };
};

const mergeDrivers = (drivers, jobs) => {
    const foundJobs = [];
    const mergedDrivers = drivers.map((w) => {
        const jobForWorker = jobs.find(j => w.podName && w.podName.startsWith(j.name));
        if (jobForWorker) {
            foundJobs.push(jobForWorker.name);
        }
        return { ...w, job: jobForWorker ? { ...jobForWorker } : undefined };
    });

    const extraJobs = jobs.filter((job) => {
        return !foundJobs.find(j => j === job.name);
    });
    return { mergedDrivers, extraJobs };
};

const normalizeDriversAmount = (jobs, requests, settings) => {
    const { minAmount, maxAmount, name } = settings;
    let amount = minAmount;
    const jobRequests = [];
    if (requests.length === 0) {
        jobRequests.push({ name, pods: 0 });
    }
    else {
        jobRequests.push(...requests);
    }
    return jobRequests.map((r) => {
        if (r.pods > minAmount) {
            amount = maxAmount;
        }
        const missingDrivers = amount - jobs.length;
        return { name: r.name, pods: missingDrivers };
    });
};

module.exports = {
    normalizeWorkers,
    normalizeDrivers,
    normalizeRequests,
    normalizeDriversRequests,
    normalizeJobs,
    normalizeDriversJobs,
    mergeWorkers,
    mergeDrivers,
    normalizeResources,
    normalizeDriversAmount
};
