const etcdDiscovery = require('./discovery');
const WORKERS_PATH = `/services/workers`;
const stateMachine = require('javascript-state-machine');
const { workerStates } = require('../../common/consts/states');
class StateManager {
    constructor() {
        this._stateMachine = null;
    }
    async init(options) {
        this._initStateMachine();
    }

    _initStateMachine() {
        this._stateMachine = new stateMachine({
            init: workerStates.ready,
            transitions: [
                { name: 'prepare', from: workerStates.ready, to: workerStates.init },
                { name: 'start', from: workerStates.init, to: workerStates.working },
                { name: 'finish', from: workerStates.working, to: workerStates.shutdown },
                { name: 'done', from: workerStates.shutdown, to: workerStates.ready },
                { name: 'error', from: workerStates.working, to: workerStates.error },
            ]
        });
    }

    get state(){
        return this._stateMachine.state;
    }
    set state(s){
        return this._stateMachine.state=s;
    }

    /**
     * transitions from ready to init
     * Performs init of the data via adapters.
     * 
     * @param {object} options 
     * @param {object} options.job the job object to work on
     * @memberof StateManager
     */
    prepare(options) {
        this._stateMachine.prepare();
    }

    /**
     * transitions from init to ready
     * starts the algorithm
     * 
     * @param {object} options 
     * @memberof StateManager
     */
    start(options) {
        this._stateMachine.start();
    }
    /**
     * transitions from working to shutdown
     * after the job is done, copy the results, and cleanup
     * 
     * @param {object} options 
     * @memberof StateManager
     */
    finish(options) {
        this._stateMachine.finish();
    }
        
    /**
     * transitions from shutdown to ready
     * finishes the processing, and ready for a new job
     * 
     * @param {object} options 
     * @memberof StateManager
     */
    done(options) {
        this._stateMachine.done();
    }
    /**
     * transitions from working to error
     * reports the error, cleanup the job and prepare for a new job
     * 
     * @param {object} options 
     * @memberof StateManager
     */
    error(options) {
        this._stateMachine.error();
    }

    async setWorkerState(options) {
        const { job } = options;
        await etcdDiscovery.setState({ data: { job } })
    }
}

module.exports = new StateManager();