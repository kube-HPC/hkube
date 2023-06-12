const logger = require('@hkube/logger');
const { tracer, metrics, utils } = require('@hkube/metrics');
const { metricsNames } = require('../consts/metricsNames');
const component = require('../consts/componentNames').METRICS;
let log;
class PipelineMetrics {
    init() {
        log = logger.GetLogFromContainer();
        metrics.addTimeMeasure({
            name: metricsNames.pipelines_net,
            description: 'pipelines runtime histogram',
            labels: ['pipeline_name', 'status'],
            buckets: utils.arithmatcSequence(30, 0, 2)
                .concat(utils.geometricSequence(10, 56, 2, 1).slice(2)).map(i => i * 1000)
        });
        metrics.addCounterMeasure({
            name: metricsNames.pipeline_started,
            description: 'Number of times the pipeline has started',
            labels: ['pipeline_name'],
        });
        metrics.addCounterMeasure({
            name: metricsNames.pipeline_ended,
            description: 'Number of times the pipeline has ended',
            labels: ['pipeline_name', 'status'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_queueSize,
            description: 'Edge queue size',
            labels: ['pipelineName', 'jobId', 'source', 'target', 'status'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_throughput,
            description: 'Edge throughput',
            labels: ['pipelineName', 'jobId', 'source', 'target', 'status'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_queueTimeMs,
            description: 'Edge queue time in ms',
            labels: ['pipelineName', 'jobId', 'source', 'target', 'status'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_processingTimeMs,
            description: 'Edge proccessing time in ms',
            labels: ['pipelineName', 'jobId', 'source', 'target', 'status'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_pods_per_node,
            description: 'Pod count per node',
            labels: ['pipelineName', 'jobId', 'node'],
        });
    }

    startMetrics(options) {
        const { jobId, pipeline, spanId } = options;
        if (!jobId || !pipeline) {
            return;
        }
        metrics.get(metricsNames.pipeline_started).inc({
            labelValues: {
                pipeline_name: pipeline,
            }
        });
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

    setStreamingEdgeGaugeMetric(options, metricName) {
        const { value, pipelineName, jobId, source, target, status } = options;
        metrics.get(`pipeline_driver_streaming_edge_${metricName}`).set({
            value,
            labelValues: {
                pipelineName,
                jobId,
                source,
                target,
                status
            }
        });
    }

    setStreamingGeneralMetric(options, metricName) {
        const { value, pipelineName, jobId, node } = options;
        metrics.get(`pipeline_driver_streaming_${metricName}`).set({
            value,
            labelValues: {
                pipelineName,
                jobId,
                node
            }
        });
    }

    endMetrics(options) {
        const { jobId, pipeline, status } = options;
        if (!jobId || !pipeline) {
            return;
        }
        try {
            metrics.get(metricsNames.pipeline_ended).inc({
                labelValues: {
                    pipeline_name: pipeline,
                    status
                }
            });
            metrics.get(metricsNames.pipelines_net).end({
                id: jobId,
                labelValues: {
                    pipeline_name: pipeline,
                    status
                }
            });

            const topSpan = tracer.topSpan(jobId);
            if (topSpan) {
                topSpan.addTag({ status });
                topSpan.finish();
            }
        }
        catch (e) {
            log.error(e.message, { component });
        }
    }
}

module.exports = new PipelineMetrics();
