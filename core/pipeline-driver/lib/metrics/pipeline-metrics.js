const { tracer, metrics, utils } = require('@hkube/metrics');
const { metricsNames } = require('../consts/metricsNames');

class PipelineMetrics {
    init() {
        metrics.addTimeMeasure({
            name: metricsNames.pipelines_net,
            description: 'pipelines runtime histogram',
            labels: ['pipeline_name', 'status'],
            buckets: utils.arithmatcSequence(30, 0, 2)
                .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
        });

        metrics.addGaugeMeasure({
            name: metricsNames.pipelines_progress,
            description: 'pipelines progress',
            labels: ['pipeline_name', 'jobId', 'status'],
        });
    }

    startMetrics(options) {
        const { jobId, pipeline, spanId } = options;
        if (!jobId || !pipeline) {
            return;
        }
        metrics.get(metricsNames.pipelines_net).start({
            id: jobId,
            labelValues: {
                pipeline_name: pipeline
            }
        });
        tracer.startSpan({
            name: 'startPipeline',
            id: jobId,
            parent: spanId
        });
    }

    endMetrics(options) {
        const { jobId, pipeline, status } = options;
        if (!jobId || !pipeline) {
            return;
        }
        metrics.get(metricsNames.pipelines_net).end({
            id: jobId,
            labelValues: {
                pipeline_name: pipeline,
                status
            }
        });

        this.setProgressMetric(options);

        const topSpan = tracer.topSpan(jobId);
        if (topSpan) {
            topSpan.addTag({ status });
            topSpan.finish();
        }
    }

    setProgressMetric(options) {
        const { jobId, pipeline, progress, status } = options;
        metrics.get(metricsNames.pipelines_progress).set({
            value: progress,
            labelValues: {
                status,
                jobId,
                pipeline_name: pipeline
            }
        });
    }
}

module.exports = new PipelineMetrics();
