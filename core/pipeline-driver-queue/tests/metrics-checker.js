const aggregationMetricsFactory = require('../lib/metrics/aggregation-metrics-factory');
const { queueEvents } = require('../lib/consts');
const { stubTemplate } = require('./stub/stub');

async function sleep(timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, timeoutMs));
}

/**
 * Simulate adding/popping jobs to the queue for different periods, so we can check relevant metrics and prometheus behaviour.
 */
async function insertPopJobs(pipelineName, qSecDurationArr) {
    for (let i = 0; i < qSecDurationArr.length; i++) {
        const tiq = qSecDurationArr[i] * 1000 - 8;
        let job = stubTemplate();
        job.pipelineName = pipelineName;
        queueRunner.queue.emit(queueEvents.INSERT, job);
        await sleep(tiq);
        queueRunner.queue.emit(queueEvents.POP, job);
        log.info(`"ADDED" ${pipelineName} JOB to Q for ${tiq} ms...`);
        await sleep(60000 - tiq);
    };
}

describe('Test', () => {
    it('should added to queue', async () => {
        insertPopJobs('pipe-long', [8, 2, 32, 4, 16]);
        insertPopJobs('pipe-short', [4, 8, 4, 2]);
    });
});
