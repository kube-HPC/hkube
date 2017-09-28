/*
 * Created by nassi on 28/08/16.
 */

'use strict';

var chai = require("chai");
var expect = chai.expect;
var sinon = require('sinon');
var mockery = require('mockery');
var Backoff = require('./lib/backoff');
var count1 = 0;
var count2 = 0;
var count3 = 0;
const RETRIES = 30;

function testCallback(param, callback) {
    setTimeout(() => {
        if (count1++ < RETRIES) {
            return callback(new Error('Callback Error'))
        }
        return callback(null, param)
    }, 200)
}

function testPromise(param) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            if (count2++ < RETRIES) {
                return reject(new Error('Promise Error'))
            }
            return resolve(param)
        }, 200)
    });
}

function testNoPromise(param) {
    if (count3++ < RETRIES) {
        throw new Error('Sync Error');
    }
    return true;
}

function testSync(param) {
    if (count3++ < RETRIES) {
        throw new Error('Sync Error');
    }
    return true;
}

describe('Backoff', function () {

    before(function (done) {
        mockery.enable({
            useCleanCache: false,
            warnOnReplace: true,
            warnOnUnregistered: false
        });
        done()
    });
    after(function (done) {
        mockery.deregisterAll();
        mockery.disable(); // Disable Mockery after tests are completed
        done()
    });

    describe('Actions', function () {
        describe('Validation', function () {
            it('should success to run backoff with no args', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'callback',
                    func: testCallback
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Callback Error');
                    done();
                });
            });
            it('should failed when options.args is not array', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'callback',
                    func: testCallback,
                    args: {}
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('args must be from type array');
                    done();
                });
            });
            it('should failed when options.type is invalid', function (done) {
                let backoff = new Backoff();
                let options = {
                    type: 'no_such',
                    func: testCallback,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('type must be provided (promise,callback,sync)');
                    done();
                });
            });
            it('should failed when options.func is not a function', function (done) {
                let backoff = new Backoff();
                let options = {
                    type: 'no_such',
                    func: [32],
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('func must be from type function');
                    done();
                });
            });
            it('should failed when options.func is not a promise', function (done) {
                let backoff = new Backoff();
                let options = {
                    type: 'promise',
                    func: testNoPromise,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('func must be from type promise');
                    done();
                });
            });
        });
        describe('Retry', function () {
            it('should perform success retry three times', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                backoff.retry((err, data) => {
                    backoff.retry((err, data) => {
                        backoff.retry((err, data) => {
                            expect(data).to.have.property('strategy');
                            expect(data).to.have.property('attempt');
                            expect(data).to.have.property('delay');

                            expect(data.strategy).to.equal('fixed');
                            expect(data.attempt).to.equal(3);
                            expect(data.delay).to.equal(100);
                            done();
                        });
                    });
                });
            });
            it('should failed to run more then three retries', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                backoff.retry((err, data) => {
                    backoff.retry((err, data) => {
                        backoff.retry((err, data) => {
                            backoff.retry((err, data) => {
                                expect(err.message).to.equal('the current attempt is reached to max attempts [3]');
                                done();
                            });
                        });
                    });
                });
            });
        });
        describe('Callback', function () {
            it('should failed to run backoff', function (done) {
                let backoff = new Backoff();
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'no_such',
                    func: testCallback,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('type must be provided (promise,callback,sync)');
                    done();
                });
            });
            it('should success to run backoff', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 2
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}`);
                });
                let options = {
                    type: 'callback',
                    func: testCallback,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Callback Error');
                    done();
                });
            });
        });
        describe('Promise', function () {
            it('should success to run backoff', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 2
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'promise',
                    func: testPromise,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Promise Error');
                    done();
                });
            });
        });
        describe('Sync', function () {
            it('should success to run backoff', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 2
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'sync',
                    func: testSync,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Sync Error');
                    done();
                });
            });
        });
    });
    describe('Strategy', function () {
        describe('fixed', function () {
            it('should success to run fixed backoff', function (done) {
                let backoff = new Backoff({
                    strategy: 'fixed',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'callback',
                    func: testCallback,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Callback Error');
                    done();
                });
            });
        });
        describe('linear', function () {
            it('should success to run backoff', function (done) {
                let backoff = new Backoff({
                    strategy: 'linear',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'callback',
                    func: testCallback,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Callback Error');
                    done();
                });
            });
        });
        describe('expo', function () {
            it('should success to run backoff', function (done) {
                let backoff = new Backoff({
                    strategy: 'expo',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'callback',
                    func: testCallback,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Callback Error');
                    done();
                });
            });
        });
        describe('fibo', function () {
            it('should success to create job', function (done) {
                let backoff = new Backoff({
                    strategy: 'fibo',
                    delay: 100,
                    maxAttempts: 3
                });
                backoff.on('retry', (error, data) => {
                    console.log(`retry -> strategy: ${data.strategy}, attempt: ${data.attempt}, delay: ${data.delay}, error: ${error.message}`);
                });
                let options = {
                    type: 'callback',
                    func: testCallback,
                    args: ['test']
                };
                backoff.run(options).catch((err) => {
                    expect(err.message).to.equal('Callback Error');
                    done();
                });
            });
        });
    });
});


