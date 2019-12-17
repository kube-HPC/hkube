const aggregationMetricsFactory = require('../../lib/metrics/aggregation-metrics-factory');
const { queueEvents } = require('../../lib/consts');
const Logger = require('@hkube/logger');
const configIt = require('@hkube/config');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const { stubTemplate } = require('./stub');
const queueRunner = require('../../lib/queue-runner');

async function sleep(timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

async function init() {
    await aggregationMetricsFactory.init(main);
    await queueRunner.init(main);
    queueRunner.queue.persistence = null;
}

/**
 * Simulate adding/popping jobs to the queue for different periods, so we can check relevant metrics and prometheus behaviour.
 */
async function insertPopTasks(algname, qSecDurationArr) {
    for (let i = 0; i < qSecDurationArr.length; i++) {
        const tiq = qSecDurationArr[i] * 1000 - 8;
        let task = stubTemplate();
        task.algorithmName = algname;
        queueRunner.queue.emit(queueEvents.INSERT, [task]);
        await sleep(tiq);
        queueRunner.queue.emit(queueEvents.POP, task);
        log.info(`"ADDED" ${algname} TASK to Q for ${tiq} ms...`);
        await sleep(60000 - tiq);
    };
}

async function check() {
    await init();
    insertPopTasks('alg-long', [2, 4, 3, 8, 16, 32]);
    insertPopTasks('alg-short', [2, 8, 4]);
    log.info('DONE');
}

