const EventEmitter = require('events');
const Logger = require('@hkube/logger');
let log;
const djsv = require('djsv');
const schema = require('./inputAdaptersSchema').inputAdaptersSchema;
const LoopbackAdapter = require('./loopbackAdapter');
const CopyFileAdapter = require('./copyFileAdapter');
const adapters = require('./consts').adapters;
const stateManager = require('../states/stateManager');
const { stateEvents } = require('../../common/consts/events');
const { workerStates } = require('../../common/consts/states');

class InputAdapters extends EventEmitter {
    constructor() {
        super();
        this._options = null;
        this._adapters = {};
        this._adapters[adapters.copyFile] = new CopyFileAdapter();
        this._adapters[adapters.loopback] = new LoopbackAdapter();
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

        await Promise.all(Object.keys(this._adapters).map(async adapterName=>{
            await this._adapters[adapterName].init(options.inputAdapters[adapterName]);
        }))
        stateManager.on(stateEvents.stateEntered+workerStates.init,async ({job,state})=>{
            log.info(`input adapters activated with data: ${JSON.stringify(job.data.input)}`)
            await this.handleInputs(job,job.data.input)
        })
    }

    async handleInputs(job,inputs){
        
    }
}

module.exports=new InputAdapters();