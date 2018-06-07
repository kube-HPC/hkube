module.exports = {
    workerStates: {
        bootstrap: 'bootstrap',
        ready: 'ready',
        init: 'init',
        working: 'working',
        shutdown: 'shutdown',
        error: 'error',
        stop: 'stop',
        results: 'results',
        exit: 'exit'
    },
    workerCommands: {
        stopProcessing: 'stopProcessing',
        startProcessing: 'startProcessing'
    }
};
