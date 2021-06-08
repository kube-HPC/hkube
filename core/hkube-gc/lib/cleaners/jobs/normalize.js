const moment = require('moment');

const waitingReasons = ['ImagePullBackOff', 'ErrImagePull'];
const normalizeRequests = (requests) => {
    if (requests == null || requests.length === 0 || requests[0].data == null) {
        return [];
    }

    const reqArray = requests[0].data.map(r => ({ algorithmName: r.name }));
    const requestedTypes = reqArray.reduce((prev, cur) => {
        prev[cur.algorithmName] = (prev[cur.algorithmName] || 0) + 1; // eslint-disable-line
        return prev;
    }, {});
    return requestedTypes;
};

/**
 * For completed pods we check that all the containers has been terminated with exitCode 0
 * For failed pods we check that at least one is terminated with non-zero code or
 * at least one is terminated and one is not.
 */
const normalizePods = (podsRaw, requestsRaw, jobsRaw) => {
    if (!podsRaw || !podsRaw.body || !podsRaw.body.items) {
        return [];
    }
    const requests = requestsRaw && normalizeRequests(requestsRaw);
    const pods = podsRaw.body.items.map((p) => {
        const cs = p.status.containerStatuses || [];
        const completed = cs.every(c => c.state.terminated && c.state.terminated.exitCode === 0);
        const failed = cs.some(c => c.state.terminated && c.state.terminated.exitCode !== 0)
            || (cs.some(c => c.state.terminated) && cs.some(c => !c.state.terminated));
        const waiting = cs.some(c => c.state.waiting && waitingReasons.includes(c.state.waiting.reason));
        const conditions = !(p.status && p.status.conditions) ? [] : p.status.conditions.map(c => ({
            unschedulable: c.reason === 'Unschedulable'
        }));
        const unschedulable = conditions.some(c => c.unschedulable);
        const algorithmName = p.metadata.labels['algorithm-name'];
        const requested = requests && requests[algorithmName] > 0;
        const age = moment().diff(moment(p.status.startTime), 'minutes', true);

        return {
            podName: p.metadata.name,
            jobName: p.metadata.labels['job-name'],
            failed,
            waiting,
            completed,
            unschedulable,
            requested,
            age
        };
    });

    if (jobsRaw && jobsRaw.body && jobsRaw.body.items) {
        const jobs = jobsRaw.body.items
            .filter(j => !pods.find(p => p.jobName === j.metadata.name))
            .map((j) => {
                const age = moment().diff(moment(j.status.startTime), 'minutes', true);
                const { failed, succeeded } = j.status;
                return {
                    jobName: j.metadata.name,
                    failed,
                    completed: succeeded,
                    age
                };
            });
        jobs.forEach(j => {
            pods.push(j);
        });
    }
    return pods;
};

module.exports = {
    normalizePods
};
