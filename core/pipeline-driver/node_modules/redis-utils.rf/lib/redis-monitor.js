/*
 * Created by nassi on 21/03/16.
 * This simple tool is designed to check redis connectivity.
 *
 * Emit Events:
 * ready
 * close
 */

'use strict';

var RedisFactory = require('./redis-factory');
var EventEmitter = require('events').EventEmitter;
var util = require('util');
//var retryTimeout = 15000;

util.inherits(RedisMonitor, EventEmitter);

function RedisMonitor() {
    EventEmitter.call(this);
}

/**
 * implementation of check redis liveness there are two option for using it  
 * check and close mode and check and listens to events in order to get notifications when something happens.
 * @param {*} [options] Object with the following properties:
 * @param {string} host -  The host name of the redis host.
 * @param {string} port -  The port of the redis host.
 *  @param {number} retryTimeout - default : 15000  waiting time out before notifies if connection is not available.
  */
RedisMonitor.prototype.check = function check(options) {
    this.retryTimeout = options.retryTimeout || 15000;
    var self = this;
    return new Promise((resolve, reject) => {

        self.options = options;
        self.retries = 0;
        self.resolve = resolve;
        self.reject = reject;
        self.resolved = false;
        self.rejected = false;
        self.isSetTimeout = false;
        self.isClosed = false;

        self.client = RedisFactory.getClient(options);

        self.client.on('connect', function () {
        });
        self.client.on('ready', function () {
            self.retries = 0;
            self.isSetTimeout = false;
            self.isClosed = false;

            var message = 'redis server is ready at ' + self.options.host + ':' + self.options.port;
            if (options.sentinel) {
                message = message + '. running in redis-cluster mode (SENTINEL). ' + (self.options.host + ':' + self.options.port);
            }

            clearTimeout(self.timeout);
            self.emit('ready', {message: message, client: self.client});
            if (!self.resolved) {
                self.resolved = true;
                self.resolve();
            }
        });
        self.client.on('error', function (error) {
        });
        self.client.on('close', function () {
            if (!self.isSetTimeout) {
                self.isSetTimeout = true;
                self._setTimeout();

                if (self.resolved && !self.isClosed) {
                    self.isClosed = true;
                    var error = new Error('unable to connect redis at ' + self.options.host + ':' + self.options.port);
                    self.emit('close', {error: error, client: self.client});
                }
            }
        });
        self.client.on('reconnecting', function () {
            self.retries++;
        });
        self.client.on('end', function () {
            if (!self.rejected) {
                self.rejected = true;

                self.reject(new Error('unable to connect redis. (' + self.retries + ' retries)'));
            }
            self.retries = 0;
        });
    });
};

RedisMonitor.prototype._setTimeout = function _setTimeout() {

    var self = this;
    self.timeout = setTimeout(()=> {
        self.isSetTimeout = false;
        var error = new Error('unable to connect redis at ' + self.options.host + ':' + self.options.port + ', connection timeout. (' + (this.retryTimeout / 1000) + ' seconds, ' + self.retries + ' retries)');
        self.retries = 0;
        if (!self.rejected) {
            self.rejected = true;
            return self.reject(error);
        }
        else {
            self.emit('close', {error: error, client: self.client});
        }
    }, this.retryTimeout);
};





module.exports = RedisMonitor;

