module.exports = {
    metricsNames: {
        pipelines_net: 'pipeline_driver_pipelines_net',
        pipeline_started: 'pipeline_driver_pipeline_started',
        pipeline_ended: 'pipeline_driver_pipeline_ended',

        streaming_edge_queueSize: 'pipeline_driver_streaming_edge_queue_size',
        streaming_edge_throughput: 'pipeline_driver_streaming_edge_throughput',
        streaming_edge_queueTimeMs: 'pipeline_driver_streaming_edge_queue_time',
        streaming_edge_processingTimeMs: 'pipeline_driver_streaming_edge_processing_time',

        streaming_pods_per_node: 'pipeline_driver_streaming_pods_per_node',
    },
    streamingEdgeMetricToPropMap: {
        queue_size: {
            propName: 'queueSize',
            registerZeroValue: true
        },
        throughput: {
            propName: 'throughput',
            registerZeroValue: false
        },
        queue_time: {
            propName: 'queueTimeMs',
            registerZeroValue: true
        },
        processing_time: {
            propName: 'processingTimeMs',
            registerZeroValue: false
        },
    },
    streamingGeneralMetricToPropMap: {
        pods_per_node: {
            propName: 'currentSize',
            registerZeroValue: true
        }
    }

};
