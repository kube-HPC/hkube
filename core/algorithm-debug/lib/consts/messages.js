module.exports = {
    outgoing: {
        initialized: 'initialized',
        started: 'started',
        stopped: 'stopped',
        stopping: 'stopping',
        progress: 'progress',
        error: 'errorMessage',
        streamingStatistics: 'streamingStatistics',
        servingStatus: 'servingStatus',
        startRawSubPipeline: 'startRawSubPipeline',
        startStoredSubPipeline: 'startStoredSubPipeline',
        stopSubPipeline: 'stopSubPipeline',
        startSpan: 'startSpan',
        finishSpan: 'finishSpan',
        startAlgorithmExecution: 'startAlgorithmExecution',
        stopAlgorithmExecution: 'stopAlgorithmExecution',
        storing: 'storing',
        done: 'done'
    },
    incoming: {
        initialize: 'initialize',
        streaming: 'streaming',
        start: 'start',
        message: 'message',
        cleanup: 'cleanup',
        stop: 'stop',
        exit: 'exit',
        serviceDiscoveryUpdate: 'serviceDiscoveryUpdate',
        subPipelineStarted: 'subPipelineStarted',
        subPipelineError: 'subPipelineError',
        subPipelineDone: 'subPipelineDone',
        subPipelineStopped: 'subPipelineStopped',
        execAlgorithmError: 'algorithmExecutionError',
        execAlgorithmDone: 'algorithmExecutionDone'
    }
};
