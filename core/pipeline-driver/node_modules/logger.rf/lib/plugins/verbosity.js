/*
 * Created by nassi on 02/02/17.
 */

'use strict';

const RedisFactory = require('redis-utils.rf').Factory;
const PubSubAdapter = require('pub-sub-adapter.rf');
const BasePlugin = require('./basePlugin');
const loggerType = require('../consts/logger-type');
const TOPIC = 'rms-logger-api-trace-level';
let uniqueKey;
var client;

class VerbosityPlugin extends BasePlugin {

    constructor(options) {
        super();
        this._options = options;
    }

    start(logger) {
        if (!this._options.host) {
            throw new Error('Verbosity plugin requires redis config');
        }
        uniqueKey = TOPIC + '-' + logger.serviceName;
        client = RedisFactory.getClient(this._options);

        this._loadVerbosityLevel().then((data) => {
            if (data && data.level) {
                logger.updateTraceLevel(data.level);
            }
        });
        this._pubSubAdapter = new PubSubAdapter({
            host: this._options.host,
            port: this._options.port,
            sentinel: this._options.sentinel
        });
        this._pubSubAdapter.on('error', (error) => {
        });
        this._pubSubAdapter.requestReplySubscribe(uniqueKey + '-set', (data, callback) => {
            if (!data || data.level == null) {
                return callback({error: 'debug level is missing'});
            }
            let found = false;
            Object.keys(loggerType).forEach((l) => {
                let level = loggerType[l];
                if (data.level === level) {
                    found = true;
                }
            });
            if (!found) {
                return callback({error: `debug level is invalid (${data.level})`});
            }
            client.set(uniqueKey, JSON.stringify({level: data.level}), (err, res) => {
                if (err) {
                    return callback({error: `unable to save debug level`});
                }
                else {
                    logger.updateTraceLevel(data.level);
                    return callback({data: 'ok'});
                }
            });
        });
        this._pubSubAdapter.requestReplySubscribe(uniqueKey + '-get', (data, callback) => {
            return callback({data: logger.config.verbosityLevel});
        });
    }

    _loadVerbosityLevel() {
        return new Promise((resolve, reject) => {
            client.get(uniqueKey, (err, res) => {
                if (err) {
                    return reject(err)
                }
                return resolve(JSON.parse(res))
            });
        });
    }
}

module.exports = VerbosityPlugin;
