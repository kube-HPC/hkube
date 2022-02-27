const bootstrap = require('../bootstrap');
let queueRunner;
before(async function () {
    await bootstrap.init();
    queueRunner = require('../lib/queue-runner');
    global.consumer = require('../lib/jobs/consumer');
});
beforeEach(async () => {
    queueRunner.queue.queue = [];
    queueRunner.preferredQueue.queue = [];
});