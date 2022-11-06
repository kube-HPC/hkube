const log = require('@hkube/logger').GetLogFromContainer();
let lastRun = [];
let active = false;
const INTERVAL = 100000;
let _db = null;
const _getJobStatus = async () => {
    if (_db) {
        const jobs = await _db.jobs.getPipelinesStats({ limit: 1000 });
        lastRun = jobs;
    }
};

const getJobStatus = async () => {
    try {
        await _getJobStatus();
    }
    catch (e) {
        log.error(e.message, { component: 'pipeline-stats' }, e);
    }
    finally {
        setTimeout(getJobStatus, INTERVAL); // 100 seconds
    }
};

const checkJobStatus = async () => {
    if (active) {
        return;
    }
    active = true;
    await getJobStatus();
};

const getPipelinesStats = async ({ db }) => {
    _db = db;
    await checkJobStatus();

    return lastRun.length === 0 ? undefined : lastRun;
};

module.exports = getPipelinesStats;
