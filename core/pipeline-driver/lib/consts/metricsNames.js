module.exports = {
    metricsNames: {
        pipelines_net: 'pipeline_driver_pipelines_net',
        pipeline_started: 'pipeline_driver_pipeline_started',
        pipeline_ended: 'pipeline_driver_pipeline_ended',

        streaming_edge_queueSize: 'pipeline_driver_streaming_edge_queue_size',
        streaming_edge_throughput: 'pipeline_driver_streaming_edge_throughput',
        streaming_edge_queueTimeMs: 'pipeline_driver_streaming_edge_queue_time',
        streaming_edge_proccessingTimeMs: 'pipeline_driver_streaming_proccessing_time',
        streaming_edge_status: 'pipeline_driver_streaming_edge_status'
    },
    metricPropConvertMap: {
        queue_size: 'queueSize',
        throughput: 'throughput',
        queue_time: 'queueTimeMs',
        proccesing_time: 'proccesingTimeMs',
        status: 'status'
    }
};
