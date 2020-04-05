const Logger = require('@hkube/logger');
const log = Logger.GetLogFromContainer();
const { createDriverJobSpec } = require('../jobs/jobCreator');
const kubernetes = require('../helpers/kubernetes');
const etcd = require('../helpers/etcd');
const { commands, components } = require('../consts');
const { normalizeDrivers, normalizeDriversRequests, normalizeDriversJobs, normalizeDriversAmount } = require('./normalize');
const { createContainerResource, setPipelineDriverImage } = require('./createOptions');
const { matchJobsToResources, } = require('./resources');
const component = components.DRIVERS_RECONCILER;

const _createDriverJob = (jobDetails, options) => {
    const spec = createDriverJobSpec({ ...jobDetails, options });
    const jobCreateResult = kubernetes.createJob({ spec });
    return jobCreateResult;
};

const _idleDriverFilter = (driver) => {
    const match = driver.driverStatus === 'ready' && !driver.paused;
    return match;
};

const _stopDriver = (driver) => {
    return etcd.sendCommandToDriver({ driverId: driver.id, command: commands.stopProcessing });
};

const reconcileDrivers = async ({ driverTemplates, driversRequests, drivers, jobs, versions, normResources, settings, registry, options, clusterOptions } = {}) => {
    const normDrivers = normalizeDrivers(drivers);
    const normJobs = normalizeDriversJobs(jobs, j => (!j.status.succeeded && !j.status.failed));
    const normRequests = normalizeDriversRequests(driversRequests);
    const { name, pods } = normalizeDriversAmount(normJobs, normRequests, settings);
    const createDetails = [];
    const stopDetails = [];

    const idleDrivers = normDrivers.filter(_idleDriverFilter);
    const extra = idleDrivers.length - settings.minAmount;

    if (extra > 0) {
        const extraDrivers = idleDrivers.slice(0, extra);

        if (extraDrivers.length > 0) {
            log.info(`need to stop ${extraDrivers.length} extra drivers`, { component });
            stopDetails.push(...extraDrivers.map(d => ({ id: d.id })));
        }
    }

    if (pods > 0) {
        log.info(`need to add ${pods} drivers`, { component });
        const driverTemplate = driverTemplates[name];
        const image = setPipelineDriverImage(driverTemplate, versions, registry);
        const resourceRequests = createContainerResource(driverTemplate);
        createDetails.push({
            numberOfNewJobs: pods,
            jobDetails: {
                name,
                image,
                resourceRequests,
                clusterOptions
            }
        });
    }

    const stopPromises = stopDetails.map(r => _stopDriver(r));
    const { created, skipped } = matchJobsToResources(createDetails, normResources);
    const createPromises = created.map(r => _createDriverJob(r, options));
    await Promise.all([...createPromises, ...stopPromises]);

    const reconcileResult = {};
    reconcileResult[name] = {
        required: pods,
        created: created.length,
        skipped: skipped.length,
        idle: idleDrivers.length,
        paused: stopDetails.length,
        pending: 0
    };
    return reconcileResult;
};

module.exports = {
    reconcileDrivers
};
