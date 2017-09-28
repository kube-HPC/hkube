/*
 * Created by nassi on 02/03/17.
 */

'use strict';

const EventEmitter = require('events');
const strategy = require('./strategy');
const functions = require('./functions');

class Backoff extends EventEmitter {

    constructor(options) {
        super();
        this._backoff = this._defaultBackoff(options);
        this._strategy = strategy.create(this._backoff.strategy);
        this._delayFunc = this._strategy.call(null, this._backoff.delay);
    }

    run(options) {
        return new Promise((resolve, reject) => {
            options = options || {};
            options.args = options.args || [];
            if (!this._isFunction(options.func)) {
                return reject(new TypeError('func must be from type function'));
            }
            if (!Array.isArray(options.args)) {
                return reject(new TypeError('args must be from type array'));
            }
            let attempt = 0;
            functions.run({
                options: options,
                onDone: (error, response) => {
                    this._reset();
                    if (error) {
                        return reject(error);
                    }
                    return resolve(response)
                },
                onAttempt: (data) => {
                    this._retry((err, params) => {
                        if (err) {
                            return reject(data.error);
                        }
                        this.emit('retry', data.error, params);
                        data.retry.apply(null, data.args);
                    }, ++attempt);
                }
            });
        });
    }

    retry(callback) {
        this._currentAttempt = this._currentAttempt || 0;
        this._retry(callback, ++this._currentAttempt);
    }

    _retry(callback, currentAttempt) {
        if (currentAttempt <= this._backoff.maxAttempts) {
            let delay = this._delayFunc.call(null, currentAttempt);
            let params = {strategy: this._backoff.strategy, attempt: currentAttempt, delay: delay};
            setTimeout(() => {
                return callback(null, params);
            }, delay);
        }
        else {
            this._reset();
            return callback(new Error(`the current attempt is reached to max attempts [${this._backoff.maxAttempts}]`));
        }
    }

    _reset() {
        this._currentAttempt = 0;
    }

    _defaultBackoff(backoff) {
        let defaultBackoff = {
            strategy: 'expo',
            delay: 1000,
            maxAttempts: 3
        };
        return Object.assign({}, defaultBackoff, backoff);
    }

    _isFunction(func) {
        return typeof func === 'function';
    }
}

module.exports = Backoff;

