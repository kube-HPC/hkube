module.exports = {
    incomming: {
        initialized: 'initialized',
        started: 'started',
        stopped: 'stopped',
        progress: 'progress',
        error: 'errorMessage',
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
    outgoing: {
        initialize: 'initialize',
        start: 'start',
        cleanup: 'cleanup',
        stop: 'stop',
        exit: 'exit',
        subPipelineStarted: 'subPipelineStarted',
        subPipelineError: 'subPipelineError',
        subPipelineDone: 'subPipelineDone',
        subPipelineStopped: 'subPipelineStopped',
        execAlgorithmError: 'algorithmExecutionError',
        execAlgorithmDone: 'algorithmExecutionDone'
    }
};
