const EventEmitter = require('events');
const Logger = require('logger.rf');
let log;
const djsv = require('djsv');
const schema = require('./inputAdaptersSchema').inputAdaptersSchema;
const loopbackAdapter = require('./loopbackAdapter');
const copyFileAdapter = require('./copyFileAdapter');
const adapters = require('./consts').adapters;
const stateManager = require('../states/stateManager');
const { stateEvents } = require('../../common/consts/events');
const { workerStates } = require('../../common/consts/states');

class InputAdapters extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._adapters = {};
        this._adapters[adapters.copyFile] = copyFileAdapter;
        this._adapters[adapters.loopback] = loopbackAdapter;
        this.adapter = null;

    }

    async init(options) {
        log = Logger.GetLogFromContainer();
        const validator = djsv(schema);
        const validatedOptions = validator(options.inputAdapters);
        if (validatedOptions.valid) {
            this._options = validatedOptions.instance;
        }
        else {
            throw new Error(validatedOptions.errorDescription);
        }

        stateManager.on(stateEvents.stateEntered+workerStates.init,({job,state})=>{
            log.info(`input adapters activated with data: ${JSON.stringify(job.data.inputs)}`)
            // this.handleInputs(job,job.data.inputs)
        })
    }
}

module.exports=new InputAdapters();