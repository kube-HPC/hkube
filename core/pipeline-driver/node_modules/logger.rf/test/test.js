/**
 * Created by maty2_000 on 8/13/2015.
 */
'use strict';

var chai = require("chai");
var expect = chai.expect;
var sinon = require('sinon');
var mockery = require('mockery');
var Logger = require('../index');
var VerbosityPlugin = require('../index').VerbosityPlugin;
var intercept = require('intercept-stdout');
var PubSubAdapter = require('pub-sub-adapter');
var moment = require('moment');

var redisConfig = {
    host: 'localhost', port: 6379
};
var pubSubAdapter = new PubSubAdapter(redisConfig);

var config = {
    transport: {
        console: true,
        fluentd: false,
        logstash: false,
        file: false
    },
    logstash: {
        logstashURL: "127.0.0.1",
        logstashPort: 28777
    },
    extraDetails: false,
    verbosityLevel: 1,
    isDefault: true
};

describe('Plugins', () => {
    const TOPIC_SET = 'rms-logger-api-trace-level-logger-set';
    const TOPIC_GET = 'rms-logger-api-trace-level-logger-get';

    it('should throw error when plugin is undefined', (done) => {
        expect(function () {
            let log = new Logger('test', config);
            log.plugins.use(null);
        }).to.throw(Error, 'plugin is undefined');
        done();
    });
    it('should throw error when plugin is not instance of plugin', (done) => {
        expect(function () {
            let log = new Logger('test', config);
            log.plugins.use({test: 'bla'});
        }).to.throw(TypeError, 'plugin must be instance of plugin');
        done();
    });
    it('should throw error on duplicate plugin registration', (done) => {
        expect(function () {
            let log = new Logger('test', config);
            log.plugins.use(new VerbosityPlugin(redisConfig));
            log.plugins.use(new VerbosityPlugin(redisConfig));
        }).to.throw(Error, 'plugin is already registered');
        done();
    });
    it('should not update verbosity level if not exists', (done) => {
        let log = new Logger('test', config);
        log.plugins.use(new VerbosityPlugin(redisConfig));

        setTimeout(() => {
            pubSubAdapter.requestReply(TOPIC_SET, null).then((response) => {
                expect(response.error).to.equal('debug level is missing');
                done();
            });
        }, 1000)
    });
    it('should not update verbosity level if not supplied', (done) => {
        let log = new Logger('test', config);
        log.plugins.use(new VerbosityPlugin(redisConfig));

        setTimeout(() => {
            pubSubAdapter.requestReply(TOPIC_SET, {level: null}).then((response) => {
                expect(response.error).to.equal('debug level is missing');
                done();
            });
        }, 1000)
    });
    it('should not update verbosity level if not valid', (done) => {
        let log = new Logger('test', config);
        log.plugins.use(new VerbosityPlugin(redisConfig));

        setTimeout(() => {
            pubSubAdapter.requestReply(TOPIC_SET, {level: 500}).then((response) => {
                expect(response.error).to.equal(`debug level is invalid (500)`);
                done();
            });
        }, 1000)
    });
    it('should update verbosity level', (done) => {
        let log = new Logger('test', config);
        log.plugins.use(new VerbosityPlugin(redisConfig));

        setTimeout(() => {
            pubSubAdapter.requestReply(TOPIC_SET, {level: 0}).then((response) => {
                expect(response.data).to.equal('ok');

                pubSubAdapter.requestReply(TOPIC_GET).then((response) => {
                    expect(response.data).to.equal(0);
                    done();
                });
            });
        }, 1000)
    });
});
describe('sanity-check', () => {
    let log = new Logger('test', config);
    beforeEach(() => {
        //   this.sinon.stub(console,'log');
    })
    it('should-call-debug', (done) => {
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain('debug:');
            expect(stdout).to.contain('hi debug test');
            done();
            intercetptInstance();
        })
        //  console.log('hi')
        log.debug('hi debug test');
    })
    it('should-call-info', (done) => {
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain('info:');
            expect(stdout).to.contain('hi info test');
            done();
            intercetptInstance();
        })
        //  console.log('hi')
        log.info('hi info test');
    })
    it('should-call-warning', (done) => {
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain('warning:');
            expect(stdout).to.contain('hi warning test');
            done();
            intercetptInstance();
        })
        //  console.log('hi')
        log.warning('hi warning test');
    })
    it('should-call-error', (done) => {
        let intercetptInstance = intercept((stdout, stderr) => {
            expect(stdout).to.contain('error:');
            expect(stdout).to.contain('hi error test');
            done();
            intercetptInstance();
        })
        //  console.log('hi')
        log.error('hi error test');
    })
    it('should-call-critical', (done) => {
        let intercetptInstance = intercept((stdout, stderr) => {
            expect(stdout).to.contain('critical:');
            expect(stdout).to.contain('hi critical test');
            done();
            intercetptInstance();
        })
        //  console.log('hi')
        log.critical('hi critical test');
    })
    afterEach(() => {

    })
});
describe('test-formating', () => {
    let log = new Logger('test', config);
    beforeEach(() => {

    })
    it('should-contain-format', (done) => {
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain('m  ->');
            expect(stdout).to.contain('info:');
            done();
            intercetptInstance();

        })
        log.info('hi info test');
    })
    it('should-contain-date-format', (done) => {
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain(moment().format('MMMM Do YYYY, h'));

            done();
            intercetptInstance();

        })
        log.info('hi info test');
    })
    it('component-name', (done) => {
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain('( test-Component )');
            done();
            intercetptInstance();

        })
        log.info('hi info test', {component: 'test-Component'});
    })
    afterEach(() => {

    })
});
describe('should-contain-extra-details', () => {

    beforeEach(() => {

    })
    it('extra-details-flag-on', (done) => {
        let relativeConfig = {
            machineType: "test",
            transport: {
                console: true,
                fluentd: false,
                logstash: false,
                file: false
            },
            logstash: {
                logstashURL: "127.0.0.1",
                logstashPort: 28777
            },
            extraDetails: true,
            verbosityLevel: 1
        }
        let log = new Logger('test', relativeConfig);
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain('{{');
            expect(stdout).to.contain('test.js');
            expect(stdout).to.contain('lineNumber:');
            done();
            intercetptInstance();

        })
        log.info('hi info test', {component: 'test-Component'});
    })
    it('extra-details-flag-off', (done) => {
        let relativeConfig = {
            machineType: "test",
            transport: {
                console: true,
                fluentd: false,
                logstash: false,
                file: false
            },
            logstash: {
                logstashURL: "127.0.0.1",
                logstashPort: 28777
            },
            extraDetails: false,
            verbosityLevel: 1,
            isDefault: true
        }
        let log = new Logger('test', relativeConfig);
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.not.contain('{{');
            expect(stdout).to.not.contain('test.js');
            expect(stdout).to.not.contain('lineNumber:');
            done();
            intercetptInstance();

        })
        log.info('hi info test', {component: 'test-Component'});
    })
    afterEach(() => {

    })
});
describe('test-trace', () => {
    beforeEach(() => {

    })
    it('should-not-contain-log-info-message', (done) => {
        let relativeConfig = {
            machineType: "test",
            transport: {
                console: true,
                fluentd: false,
                logstash: false,
                file: false
            },
            logstash: {
                logstashURL: "127.0.0.1",
                logstashPort: 28777
            },
            extraDetails: true,
            verbosityLevel: 4,
            isDefault: true
        }
        let log = new Logger('test', relativeConfig);
        let logObj = '';
        let intercetptInstance = intercept((stdout) => {
            logObj = stdout;

        })
        setTimeout(() => {
            intercetptInstance();
            expect(logObj).to.not.contain('hi info test');
            done();
        }, 1000)

        log.info('hi info test', {component: 'test-Component'});

    })
    it('should-contain-log-info-message', (done) => {
        let relativeConfig = {
            machineType: "test",
            transport: {
                console: true,
                fluentd: false,
                logstash: false,
                file: false
            },
            logstash: {
                logstashURL: "127.0.0.1",
                logstashPort: 28777
            },
            extraDetails: true,
            verbosityLevel: 2,
            isDefault: true
        }
        let log = new Logger('test', relativeConfig);
        let logObj = '';
        let intercetptInstance = intercept((stdout) => {
            logObj = stdout;

        })
        log.info('hi info test', {component: 'test-Component'});
        setTimeout(() => {
            intercetptInstance();
            expect(logObj).to.contain('hi info test');
            done();
        }, 1000)


    })
    it('should-update-trace-level-during-run', (done) => {
        let relativeConfig = {
            machineType: "test",
            transport: {
                console: true,
                fluentd: false,
                logstash: false,
                file: false
            },
            logstash: {
                logstashURL: "127.0.0.1",
                logstashPort: 28777
            },
            extraDetails: true,
            verbosityLevel: 4,
            isDefault: true
        }
        let log = new Logger('test', relativeConfig);
        let logObj = '';
        let intercetptInstance = intercept((stdout) => {
            logObj = stdout;

        })
        setTimeout(() => {
            // first testing that not received
            expect(logObj).to.not.contain('hi info test');
            setTimeout(() => {
                // updating trace level and verfiy that log received
                log.updateTraceLevel(1);
                log.info('hi info test', {component: 'test-Component'});
                intercetptInstance();
                expect(logObj).to.contain('hi info test');
                done();

            }, 500)


        }, 500)

        log.info('hi info test', {component: 'test-Component'});

    })
    afterEach(() => {

    })
});
describe('test-get-logger-from-container-without-container-name', () => {
    beforeEach(() => {

    })
    it('get-without-container-name', (done) => {

        let relativeConfig = {
            machineType: "test",
            transport: {
                console: true,
                fluentd: false,
                logstash: false,
                file: false
            },
            logstash: {
                logstashURL: "127.0.0.1",
                logstashPort: 28777
            },
            extraDetails: true,
            verbosityLevel: 2,
            isDefault: true
        };
        let logger = new Logger('test', relativeConfig);
        let log = Logger.GetLogFromContainer();
        let intercetptInstance = intercept((stdout) => {
            expect(stdout).to.contain('hi info test');
            done();
            intercetptInstance();

        })
        log.info('hi info test', {component: 'test-Component'});
    })
    afterEach(() => {

    })
});

