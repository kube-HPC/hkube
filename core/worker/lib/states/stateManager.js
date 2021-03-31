const EventEmitter = require('events');
const StateMachine = require('javascript-state-machine');
const Logger = require('@hkube/logger');
const { tracer } = require('@hkube/metrics');
const { workerStates, stateEvents, Components } = require('../consts');

const component = Components.STATE_MANAGER;
let log;

/**
 * Handles states of the system
 * @event stateEntered when a new state is entered
 * @class StateManager
 * @extends {EventEmitter}
 */
class StateManager extends EventEmitter {
    constructor() {
        super();
        this._stateMachine = null;
        this._job = null;
        this._results = null;
        this._isTtlExpired = false;
        this._forceStop = true;
        this._inactiveTimer = null;
    }

    async init(config) {
        this._config = config;
        this._debugMode = config.debugMode;
        this._devMode = config.devMode;
        log = Logger.GetLogFromContainer();
        this._initStateMachine();
        this._startInactiveTimer();
    }

    _initStateMachine() {
        if (this._stateMachine) {
            this.removeAllListeners();
        }
        this._stateMachine = new StateMachine({
            init: workerStates.bootstrap,
            transitions: [
                { name: 'reset', from: '*', to: workerStates.bootstrap },
                { name: 'stop', from: '*', to: workerStates.stop },
                { name: 'bootstrap', from: workerStates.bootstrap, to: workerStates.ready },
                { name: 'prepare', from: workerStates.ready, to: workerStates.init },
                { name: 'start', from: workerStates.init, to: workerStates.working },
                { name: 'done', from: [workerStates.bootstrap, workerStates.ready, workerStates.shutdown, workerStates.working, workerStates.stop, workerStates.init], to: workerStates.results },
                { name: 'cleanup', from: workerStates.results, to: workerStates.ready },
                { name: 'error', from: [workerStates.working, workerStates.init], to: workerStates.error },
                { name: 'exit', from: '*', to: workerStates.exit }
            ],
            methods: {
                onPendingTransition: (transition, from, to) => { // eslint-disable-line
                },
                onInvalidTransition: (transition, from, to) => {
                    if (!this._debugMode && !this._devMode) {
                        log.warning(`transition (${transition}) not allowed from that state: ${from} -> ${to}`, { component });
                        this.exit({ shouldCompleteJob: false });
                    }
                }
            }
        });
        this._stateMachine.observe('onBeforeTransition', (state) => {
            log.debug(`before entered state: ${state.from} -> ${state.to}`, { component });
        });

        this._stateMachine.observe('onEnterState', (state) => {
            if (this._job && this._job.data && state.to !== workerStates.ready) {
                let parent;
                const topSpan = tracer.topSpan(this._job.data.jobId);
                if (topSpan) {
                    parent = topSpan.context();
                }
                tracer.startSpan({
                    name: state.to,
                    id: this._job.data.taskId,
                    parent,
                    tags: {
                        jobId: this._job.data.jobId,
                        taskId: this._job.data.taskId,
                    }
                });
            }
            else if (this._job && this._job.data && state.to === workerStates.ready) {
                this.emit('finish');
            }
            if (state.to === workerStates.bootstrap) {
                this._startInactiveTimer();
            }
            else {
                clearTimeout(this._inactiveTimer);
                this._inactiveTimer = null;
            }
        });

        this._stateMachine.observe('onLeaveState', (transition) => {
            if (this._job && this._job.data) {
                const topSpan = tracer.topSpan(this._job.data.taskId);
                if (topSpan && topSpan.name === transition.from) {
                    topSpan.finish();
                }
            }
        });

        this._stateMachine.observe('onAfterTransition', (state) => {
            log.debug(`after entered state: ${state.from} -> ${state.to}`, { component });

            const data = {
                job: this._job,
                state: this._stateMachine.state,
                ...this.results && { results: this.results },
                isTtlExpired: this._isTtlExpired,
                forceStop: this._forceStop
            };

            this.emit(stateEvents.stateEntered, data);
            this.emit(stateEvents.stateEntered + this._stateMachine.state, data);
        });
    }

    get state() {
        return this._stateMachine.state;
    }

    /**
         * transitions from any state to bootstrap
         *
         * @memberof StateManager
         */
    reset() {
        this._stateMachine.reset();
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
    stop({ isTtlExpired = false, forceStop = true } = {}) {
        try {
            this._isTtlExpired = isTtlExpired;
            this._forceStop = forceStop;
            this._stateMachine.stop();
        }
        catch (error) {
            log.warning(error, { component });
        }
    }

    /**
     * transitions to exit state.
     */
    exit(results) {
        try {
            this._results = results;
            this._stateMachine.exit();
        }
        catch (error) {
            log.warning(error, { component });
        }
    }

    /**
     * transitions from working to results
     * finishes the processing, and get the results
     *
     * @param {object} results
     * @memberof StateManager
     */
    done(results) {
        try {
            this._results = results;
            this._stateMachine.done();
        }
        catch (error) {
            log.warning(error, { component });
        }
    }

    /**
     * transitions from results to ready
     * finishes the processing, and ready for a new job
     *
     * @memberof StateManager
     */
    cleanup() {
        try {
            this._isTtlExpired = false;
            this._stateMachine.cleanup();
            this._forceStop = true;
        }
        catch (error) {
            log.warning(error, { component });
        }
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

    _startInactiveTimer() {
        if (this._config.timeouts.algorithmDisconnected > 0) {
            const seconds = `${this._config.timeouts.algorithmDisconnected / 1000} seconds`;
            log.info(`starting inactive timeout for algorunner (bootstrap) ${seconds}`, { component });
            this._inactiveTimer = setTimeout(() => {
                // this.exit(); instead of exit the process, we will emit event
                this.emit('disconnect', `algorunner is offline for more than ${seconds}`);
            }, this._config.timeouts.algorithmDisconnected);
        }
    }
}

module.exports = new StateManager();
