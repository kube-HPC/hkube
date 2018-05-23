const {expect} = require('chai');
const bootstrap = require('../bootstrap');
const mockery = require('mockery');
const {cronTask} = require('../lib/triggers/index');
const stubTask = {
    name: 'stub',
    triggers: {
        cron: '*/1 * * * * * *'
    }
};

describe('test', () => {
    before(async () => {
        await bootstrap.init();
        mockery.enable({
            warnOnReplace: false,
            warnOnUnregistered: false,
            useCleanCache: true
        });
    });
    describe('should send cron ', () => {
        it('should send simple cron tests', () => {
            cronTask.addTrigger(stubTask, (name) => {
                console.log(`name:${name}`);
                expect(name).to.be.equal(stubTask.name);
            });
        });
    });
});
