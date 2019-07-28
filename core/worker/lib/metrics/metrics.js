const { metrics, utils } = require('@hkube/metrics');
const { metricsNames } = require('../consts');
const formatter = require('../helpers/formatters');
const constants = require('../consumer/consts');

class Metrics {
    init() {
        metrics.removeMeasure(metricsNames.worker_net);
        metrics.addTimeMeasure({
            name: metricsNames.worker_net,
            labels: ['pipeline_name', 'algorithm_name', 'status'],
            description: 'Algorithm runtime histogram',
            buckets: utils.arithmatcSequence(30, 0, 2)
                .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
        });
        metrics.removeMeasure(metricsNames.worker_succeeded);
        metrics.addCounterMeasure({
            name: metricsNames.worker_succeeded,
            description: 'Number of times the algorithm has completed',
            labels: ['pipeline_name', 'algorithm_name'],
        });
        metrics.removeMeasure(metricsNames.worker_runtime);
        metrics.addSummary({
            name: metricsNames.worker_runtime,
            description: 'Algorithm runtime summary',
            labels: ['pipeline_name', 'algorithm_name', 'status'],
            percentiles: [0.5]
        });
        metrics.removeMeasure(metricsNames.worker_started);
        metrics.addCounterMeasure({
            name: metricsNames.worker_started,
            description: 'Number of times the algorithm has started',
            labels: ['pipeline_name', 'algorithm_name'],
        });
        metrics.removeMeasure(metricsNames.worker_failed);
        metrics.addCounterMeasure({
            name: metricsNames.worker_failed,
            description: 'Number of times the algorithm has failed',
            labels: ['pipeline_name', 'algorithm_name'],
        });
    }

    initMetrics(job, jobType) {
        const pipelineName = formatter.formatPipelineName(job.data.pipelineName);
        metrics.get(metricsNames.worker_started).inc({
            labelValues: {
                pipeline_name: pipelineName,
                algorithm_name: jobType
            }
        });
        metrics.get(metricsNames.worker_net).start({
            id: job.data.taskId,
            labelValues: {
                pipeline_name: pipelineName,
                algorithm_name: jobType
            }
        });
        metrics.get(metricsNames.worker_runtime).start({
            id: job.data.taskId,
            labelValues: {
                pipeline_name: pipelineName,
                algorithm_name: jobType
            }
        });
    }

    summarizeMetrics(jobStatus, pipeline, algorithm, jobId, taskId) {
        const pipelineName = formatter.formatPipelineName(pipeline);
        if (jobStatus === constants.JOB_STATUS.FAILED) {
            metrics.get(metricsNames.worker_failed).inc({
                labelValues: {
                    pipeline_name: pipelineName,
                    algorithm_name: algorithm
                }
            });
        }
        else if (jobStatus === constants.JOB_STATUS.SUCCEED) {
            metrics.get(metricsNames.worker_succeeded).inc({
                labelValues: {
                    pipeline_name: pipelineName,
                    algorithm_name: algorithm
                }
            });
        }
        metrics.get(metricsNames.worker_net).end({
            id: taskId,
            labelValues: {
                status: jobStatus
            }
        });
        metrics.get(metricsNames.worker_runtime).end({
            id: taskId,
            labelValues: {
                status: jobStatus
            }
        });
    }
}

module.exports = new Metrics();
