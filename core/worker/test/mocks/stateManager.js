const EventEmitter = require('events');
const { workerStates } = require('../../lib/consts');

class StateManagerMock extends EventEmitter {
    constructor() {
        super();
        this._state = workerStates.bootstrap;
    }

    async init() {
        this._state = workerStates.ready;
    }

    set state(state) {
        this._state = state;
    }

    get state() {
        return this._state;
    }

    reset() {
        this._state = workerStates.bootstrap;
    }

    bootstrap() {
        this._state = workerStates.ready;
    }

    prepare() {
        this._state = workerStates.init;
    }

    start() {
        this._state = workerStates.working;
    }

    stop() {
        this._state = workerStates.stop;
    }

    exit() {
        this._state = workerStates.exit;
    }

    done(results) {
        this._state = workerStates.results;
    }

    cleanup() {
    }

    error() {
        this._state = workerStates.error;
    }

    setJob(job) {
    }

    get job() {
    }

    get results() {
    }
}

module.exports = new StateManagerMock();
