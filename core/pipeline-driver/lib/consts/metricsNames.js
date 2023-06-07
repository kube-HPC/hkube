module.exports = {
    metricsNames: {
        pipelines_net: 'pipeline_driver_pipelines_net',
        pipeline_started: 'pipeline_driver_pipeline_started',
        pipeline_ended: 'pipeline_driver_pipeline_ended',

        streaming_edge_queueSize: 'pipeline_driver_streaming_edge_queue_size',
        streaming_edge_throughput: 'pipeline_driver_streaming_edge_throughput',
        streaming_edge_queueTimeMs: 'pipeline_driver_streaming_edge_queue_time',
        streaming_edge_processingTimeMs: 'pipeline_driver_streaming_edge_processing_time'
    },
    streamingMetricToPropMap: {
        queue_size: 'queueSize',
        throughput: 'throughput',
        queue_time: 'queueTimeMs',
        processing_time: 'processingTimeMs'
    }
};
