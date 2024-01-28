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
            labels: ['pipelineName', 'jobId', 'source', 'target'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_throughput,
            description: 'Edge throughput',
            labels: ['pipelineName', 'jobId', 'source', 'target'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_queueTimeMs,
            description: 'Edge queue time in ms',
            labels: ['pipelineName', 'jobId', 'source', 'target'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_processingTimeMs,
            description: 'Edge proccessing time in ms',
            labels: ['pipelineName', 'jobId', 'source', 'target'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_resRate,
            description: 'Response rate',
            labels: ['pipelineName', 'jobId', 'source', 'target'],
        });
        metrics.addGaugeMeasure({
            name: metricsNames.streaming_edge_reqRate,
            description: 'Request rate',
            labels: ['pipelineName', 'jobId', 'source', 'target'],
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
        const { value, pipelineName, jobId, source, target } = options;
        metrics.get(`pipeline_driver_streaming_edge_${metricName}`).set({
            value,
            labelValues: {
                pipelineName,
                jobId,
                source,
                target
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

    // Holds an array of metrics that retain the last value and need to be cleaned
    _getMetricsToRemove() {
        return [metricsNames.streaming_edge_queueSize, metricsNames.streaming_edge_processingTimeMs,
            metricsNames.streaming_edge_throughput, metricsNames.streaming_edge_queueTimeMs,
            metricsNames.streaming_edge_resRate, metricsNames.streaming_edge_reqRate,
            metricsNames.streaming_pods_per_node];
    }

    // Called when we decide we will not send any more metrics associated to a certain jobId
    metricsCleanup(labelName, labelValue) {
        const metricsToRemove = this._getMetricsToRemove();
        metrics.removeMeasureEntries({ labelName, labelValue, metricsToRemove });
    }
}

module.exports = new PipelineMetrics();
