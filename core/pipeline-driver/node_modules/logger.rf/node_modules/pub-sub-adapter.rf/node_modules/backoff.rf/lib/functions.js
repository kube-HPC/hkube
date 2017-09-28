/*
 * Created by nassi on 08/03/17.
 */

'use strict';

const FunctionTypes = require('./consts');

class Functions {

    constructor() {
        this._runPromise = this._runPromise.bind(this);
        this._runCallback = this._runCallback.bind(this);
        this._runSync = this._runSync.bind(this);
        this._registerTypes();
    }

    run(data) {
        const functionsType = this._functionsMap[data.options.type];
        if (functionsType) {
            functionsType.call(null, data.options, data.onDone, data.onAttempt);
        }
        else {
            return data.onDone(new TypeError(`type must be provided (${Object.keys(FunctionTypes).map(k => FunctionTypes[k])})`));
        }
    }

    _runPromise(options, onDone, onAttempt) {
        this._runFunction(options.func, options.args, (error, result) => {
            if (!this._isPromise(result)) {
                return onDone(new TypeError('func must be from type promise'));
            }
            result.then((response) => {
                return onDone(null, response);
            }).catch((error) => {
                onAttempt({
                    error: error,
                    args: arguments,
                    retry: this._runPromise
                });
            });
        });
    }

    _runCallback(options, onDone, onAttempt) {
        const callbackFn = (error, response) => {
            if (error) {
                onAttempt({
                    error: error,
                    args: arguments,
                    retry: this._runCallback
                });
            }
            else {
                return onDone(null, response);
            }
        };
        while (options.args.length < options.func.length - 1) {
            options.args.push(null);
        }
        let args = options.args.concat(callbackFn);
        this._runFunction(options.func, args, (error, result) => {
            if (error) {
                return onDone(error);
            }
        });
    }

    _runSync(options, onDone, onAttempt) {
        this._runFunction(options.func, options.args, (error, response) => {
            if (error) {
                onAttempt({
                    error: error,
                    args: arguments,
                    retry: this._runSync
                });
            }
            else {
                return onDone(null, response);
            }
        });
    }

    _runFunction(func, args, callback) {
        let result = null;
        try {
            result = func.apply(null, args);
            return callback(null, result);
        }
        catch (error) {
            return callback(error);
        }
    }

    _registerTypes() {
        this._functionsMap = Object.create(null);
        this._functionsMap[FunctionTypes.PROMISE] = this._runPromise;
        this._functionsMap[FunctionTypes.CALLBACK] = this._runCallback;
        this._functionsMap[FunctionTypes.SYNC] = this._runSync;
    }

    _isPromise(func) {
        return func && typeof func.then === 'function';
    }
}

module.exports = new Functions();

