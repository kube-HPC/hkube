const EventEmitter = require('events');
const StateMachine = require('javascript-state-machine');
const { workerStates } = require('../../common/consts/states');
const { stateEvents } = require('../../common/consts/events');
const Logger = require('@hkube/logger');
let log;

/**
 * Handles states of the system
 * @event stateEntered when a new state is entered
 * @event stateEnteredSTATEXX when the STATEXX state is entered
 * @class StateManager
 * @extends {EventEmitter}
 */
class StateManager extends EventEmitter {
    constructor() {
        super();
        this._stateMachine = null;
        this._job = null;
        this._results = null;
    }
    async init() {
        log = Logger.GetLogFromContainer();
        this._initStateMachine();
    }

    _initStateMachine() {
        if (this._stateMachine) {
            this.removeAllListeners();
        }
        this._stateMachine = new StateMachine({
            init: workerStates.bootstrap,
            transitions: [
                { name: 'reset', from: '*', to: workerStates.bootstrap},
                { name: 'stop', from: '*', to: workerStates.stop},
                { name: 'bootstrap', from: workerStates.bootstrap, to: workerStates.ready},
                { name: 'prepare', from: workerStates.ready, to: workerStates.init },
                { name: 'start', from: workerStates.init, to: workerStates.working },
                { name: 'finish', from: workerStates.working, to: workerStates.shutdown },
                { name: 'done', from: [workerStates.shutdown, workerStates.working, workerStates.stop], to: workerStates.ready },
                { name: 'error', from: workerStates.working, to: workerStates.error },
            ],
            methods: {
                onPendingTransition: (transition, from, to) => { // eslint-disable-line

                }
            }
        });
        this._stateMachine.observe('onAfterTransition', (state) => {
            log.info(`entered state: ${state.from} -> ${state.to}`);
            const data = Object.assign(
                {},
                {job: this._job},
                {state: this._stateMachine.state},
                this.results ? {results: this.results} : null
            );

            this.emit(stateEvents.stateEntered, data);
            this.emit(stateEvents.stateEntered + this._stateMachine.state, data);
        });
    }

    get state() {
        return this._stateMachine.state;
    }


    /**
     * transitions from bootstrap to ready
     * Should happen after all local init (including connecting to socket)
     *
     * @memberof StateManager
     */
    bootstrap() {
        this._stateMachine.bootstrap();
    }
    /**
     * transitions from ready to init
     * Performs init of the data via adapters.
     * 
     * @memberof StateManager
     */
    prepare() {
        this._stateMachine.prepare();
    }

    /**
     * transitions from init to ready
     * starts the algorithm
     * 
     * @memberof StateManager
     */
    start() {
        this._results = null;
        this._stateMachine.start();
    }

    /**
     * transitions to stop state.
     */
    stop() {
        this._stateMachine.stop();
    }
    /**
     * transitions from working to shutdown
     * after the job is done, copy the results, and cleanup
     * 
     * @memberof StateManager
     */
    finish() {
        this._stateMachine.finish();
    }

    /**
     * transitions from shutdown to ready
     * finishes the processing, and ready for a new job
     * 
     * @param {object} results
     * @memberof StateManager
     */
    done(results) {
        this._results = results;
        this._stateMachine.done();
    }
    /**
     * transitions from working to error
     * reports the error, cleanup the job and prepare for a new job
     * 
     * @memberof StateManager
     */
    error() {
        this._stateMachine.error();
    }
    setJob(job) {
        this._job = job;
    }
    get job() {
        return this._job;
    }
    get results() {
        return this._results;
    }
}

module.exports = new StateManager();
