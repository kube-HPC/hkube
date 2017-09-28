/**
 * Created by yehiyam on 9/11/16.
 */

"use strict";

const chai = require("chai");
const expect = chai.expect;
const PubSubAdapter = require('../lib/redis-adapter');
const uuid = require('uuid/v4');
const redisHost = process.env.REDIS_SERVICE_HOST || 'localhost';

const backoff = {
    strategy: 'fibo',
    delay: 1000,
    maxAttempts: 2
};
describe('RequestReply', ()=> {

    describe('Get the reply', ()=> {
        it('should echo the message', (done)=> {
            const topic = uuid();
            let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379, requestReplyBackoff: backoff});

            pubSubAdapter.requestReplySubscribe(topic, (message, publishFunction) => {
                publishFunction(message + '_reply');
            });
            pubSubAdapter.requestReply(topic, 'request').then(reply=> {
                expect(reply).to.equal('request_reply');
                done();
            }).catch(error=> {
            });
        }).timeout(5000);
        it('should echo the message without backoff', function (done) {
            this.timeout(5000);
            const topic = uuid();
            let backoff = {
                strategy: 'off'
            };
            let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379, requestReplyBackoff: backoff});
            pubSubAdapter.requestReplySubscribe(topic, (message, publishFunction) => {
                publishFunction(message + '_reply');
            });
            pubSubAdapter.requestReply(topic, 'request').then(reply=> {
                expect(reply).to.equal('request_reply');
                done();
            }).catch(error=> {
            });
        });
    });
    describe('Timeout if no answer', ()=> {
        it('should use the default timeout', (done)=> {
            const topic = uuid();
            let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379, requestReplyBackoff: backoff});
            pubSubAdapter.requestReply(topic, {a: "1"}).catch(error=> {
                expect(error).to.not.be.undefined;
                done();
            });
        }).timeout(50000);
        it('should use the specified timeout from options', (done)=> {
            const topic = uuid();
            let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379, requestReplyTimeoutMS: 1000});
            pubSubAdapter.requestReply(topic, {a: "1"}).catch(error=> {
                expect(error).to.not.be.undefined;
                done();
            });
        }).timeout(50000);
        it('should use the specified timeout from method call', (done)=> {
            const topic = uuid();

            let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379, requestReplyBackoff: backoff});
            pubSubAdapter.requestReply(topic, {a: "1"}, 3000).then(reply=> {
            }).catch(error=> {
                expect(error).to.not.be.undefined;
                done();
            });
        }).timeout(50000);
    });
});

describe('PubSub', () => {

    it('subscribe', (done)=> {
        let id = uuid();
        let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379});

        pubSubAdapter.subscribe(id + '-subscribe', null, (error, topic) => {
            done();
        });
    });
    it('publish', (done)=> {
        let id = uuid();
        let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379});

        pubSubAdapter.subscribe(id + '-publish', (message) => {
            expect(message).to.equal('request');
            done();
        }, (error, topic) => {
            pubSubAdapter.publish(id + '-publish', 'request');
        });
    });
    it('unsubscribe', (done)=> {
        let id = uuid();
        let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379});
        let subToken;
        pubSubAdapter.subscribe(id + '-publish', (message) => {
            expect(message).to.equal('request');
            let result = pubSubAdapter.unsubscribe(id + '-publish', subToken);
            expect(result).to.equal(true);
            done();
        }, (error, token) => {
            pubSubAdapter.publish(id + '-publish', 'request');
            subToken = token;
        });
    });
    it('dispose', (done) => {
        let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379});
        pubSubAdapter.dispose();
        done();
    })
});

xdescribe('Sentinel', () => {
    it('create', (done)=> {
        let id = uuid();
        PubSubAdapter._clear();
        let pubSubAdapter = new PubSubAdapter({host: '172.16.21.19', port: 26379, sentinel: true});
        //let pubSubAdapter = new PubSubAdapter({host: redisHost, port: 6379});

        pubSubAdapter.subscribe(id + '-publish', (message) => {
            expect(message).to.equal('request');
            done();
        }, (error, topic) => {
            pubSubAdapter.publish(id + '-publish', 'request');
        });
    });

});