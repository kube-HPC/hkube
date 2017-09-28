/*
 * Created by matyz on 25/08/15.
 * Updated by yossico on 29/02/16: redis-cluster
 *
 * * Emit Events:
 * init
 * dispose
 * error
 */

"use strict";

var EventEmitter = require('events').EventEmitter;
var RedisFactory = require('redis-utils.rf').Factory;
var Backoff = require('backoff.rf');
var uuid = require('uuid/v4');
var publishClient;
var subscribeClient;
var subscriberMap = new Map();

class RedisAdapter extends EventEmitter {

    constructor(options) {
        super();
        if (!publishClient) {
            publishClient = RedisFactory.getClient(options);
        }
        if (!subscribeClient) {
            let subscribeOptions = {};
            Object.assign(subscribeOptions, options);
            subscribeOptions.role = 'slave';
            subscribeClient = RedisFactory.getClient(subscribeOptions);

            subscribeClient.on('message', (topic, message) => {
                this._returnCallBacks(topic, message);
            });
            subscribeClient.on('pmessage', (pattern, topic, message) => {
                this._returnCallBacks(pattern, message);
            });
        }
        if (options.requestReplyBackoff && options.requestReplyBackoff.strategy !== 'off') {
            this._requestReplyBackoff = this._createBackoff(options.requestReplyBackoff);
        }
        this._requestReplyTimeoutMS = options.requestReplyTimeoutMS || 4000;
    }

    setConfig(key, value) {
        publishClient.config('set', key, value);
    }

    _createBackoff(options) {
        const opt = this._defaultBackoffOptions(options);
        let backoff = new Backoff(opt);
        backoff.on('retry', (error, data) => {
            console.log(`backoff retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
        });
        return backoff;
    }

    _defaultBackoffOptions(options) {
        let defaultBackoff = {
            strategy: 'fibo',
            delay: 1000,
            maxAttempts: 5
        };
        return Object.assign({}, defaultBackoff, options);
    }

    getClient() {
        return publishClient;
    }

    static _clear() {
        console.log('PubSub Adapter _clear is for internal use only!!!');
        if (publishClient) {
            publishClient.quit();
            publishClient = null;
        }

        subscriberMap.clear();
        if (subscribeClient) {
            subscribeClient.quit();
            subscribeClient = null;
        }
    }

    publish(topic, message) {
        publishClient.publish(topic, message);
    }

    subscribe(topic, callbackFunction, registerCallBack) {

        registerCallBack = typeof registerCallBack === "function" ? registerCallBack : function () {
        };

        if (subscriberMap.has(topic)) {
            let callbackMap = subscriberMap.get(topic);
            let token = uuid();
            callbackMap.set(token, callbackFunction);
            registerCallBack(null, token);
        }
        else {
            let callbackMap = new Map();
            let token = uuid();
            callbackMap.set(token, callbackFunction);
            subscriberMap.set(topic, callbackMap);
            subscribeClient.subscribe(topic, (error, topic) => {
                registerCallBack(error, token);
            })
        }
    }

    psubscribe(pattern, callbackFunction, registerCallBack) {
        registerCallBack = typeof registerCallBack === "function" ? registerCallBack : function () {
        };

        if (subscriberMap.has(pattern)) {
            let callbackMap = subscriberMap.get(pattern);
            let guid = uuid();
            callbackMap.set(guid, callbackFunction);
            registerCallBack(null, guid);
        }
        else {
            let callbackMap = new Map();
            let guid = uuid();
            callbackMap.set(guid, callbackFunction);
            subscriberMap.set(pattern, callbackMap);
            subscribeClient.psubscribe(pattern, (error, topic) => {
                registerCallBack(error, guid);
            })
        }
    }

    _returnCallBacks(topic, message) {
        if (subscriberMap.has(topic)) {
            let callbackMap = subscriberMap.get(topic);
            callbackMap.forEach((callbackFunc, key, map) => {
                callbackFunc(message);
            })
        }
    }

    unsubscribe(topic, token) {

        let callbackMap = subscriberMap.get(topic);
        if (callbackMap) {
            callbackMap.delete(token);

            if (callbackMap.size === 0) {
                subscriberMap.delete(topic);
                subscribeClient.unsubscribe(topic);
                subscribeClient.punsubscribe(topic);
            }
            return true;
        }
        return false;
    }

    dispose() {
        console.log('PubSub Adapter dispose deprecated!!!');
        // this._publishClient.quit();
        // this._subscribeClient.quit();
        // this.emit('dispose');
    }

    requestReply(topicName, rawMessage, timeoutMS) {
        return new Promise((resolve, reject) => {
            if (this._requestReplyBackoff) {
                let options = {
                    type: 'promise',
                    func: this._requestReply.bind(this),
                    args: [topicName, rawMessage, timeoutMS]
                };
                this._requestReplyBackoff.run(options).then((response) => {
                    return resolve(response)
                }).catch((error) => {
                    return reject(error);
                });
            }
            else {
                this._requestReply(topicName, rawMessage, timeoutMS).then((response) => {
                    return resolve(response)
                }).catch((error) => {
                    return reject(error);
                })
            }
        });
    }

    _requestReply(topicName, rawMessage, timeoutMS) {
        return new Promise((resolve, reject) => {
            const orignalTopic = topicName;
            const _uuid = uuid();
            const subTopic = topicName + _uuid;
            const pubTopic = topicName + _uuid;
            const _timeoutMS = timeoutMS || this._requestReplyTimeoutMS;
            var self = this;
            let message = {
                internal: {
                    uuid: _uuid
                },
                raw: rawMessage
            };
            let unsubscribeToken = null;
            let timeout = setTimeout(() => {
                self.unsubscribe(subTopic);
                clearTimeout(timeout);
                reject(new Error(`message does not arrives for topic: ${orignalTopic} internalTopic: ${pubTopic} timeout: ${_timeoutMS}`));
            }, _timeoutMS);

            self.subscribe(subTopic, (message) => {
                self.unsubscribe(subTopic, unsubscribeToken);
                clearTimeout(timeout);
                return resolve(JSON.parse(message))
            }, (error, token) => {
                if (error) {
                    return reject(error);
                }
                unsubscribeToken = token;
                var jsonMessage = JSON.stringify(message);
                self.publish(orignalTopic, jsonMessage);
            });
        });
    }

    requestReplySubscribe(topic, callback) {
        var self = this;
        self.subscribe(topic, (jsonMessage) => {
            let message = JSON.parse(jsonMessage);
            if (message.internal.uuid != null) {
                callback(message.raw, (userMessage) => {
                    self.publish(topic + message.internal.uuid, JSON.stringify(userMessage));
                });
            }
        });
    }
}

module.exports = RedisAdapter;
