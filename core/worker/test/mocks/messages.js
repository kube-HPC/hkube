module.exports = {
    outgoing: {
        pong: 'pongMessage',
        initialized: 'initialized',
        started: 'started',
        stopped: 'stopped',
        progress: 'progress',
        error: 'errorMessage',
        startRawSubPipeline: 'startRawSubPipeline',
        startStoredSubPipeline: 'startStoredSubPipeline',
        stopSubPipeline: 'stopSubPipeline',
        done: 'done'

    },
    incomming: {
        ping: 'pingMessage',
        initialize: 'initialize',
        start: 'start',
        cleanup: 'cleanup',
        stop: 'stop',
        exit: 'exit',
        subPiplineStarted: 'subPiplineStarted',
        subPipelineError: 'subPipelineError',
        subPipelineDone: 'subPipelineDone',
        subPipelineStopped: 'subPipelineStopped'
    }
}