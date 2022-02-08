const bootstrap = require('../bootstrap');
let queueRunner;
before(async function () {
    await bootstrap.init();
    queueRunner = require('../lib/queue-runner');
});
beforeEach(async () => {
    queueRunner.queue.queue = [];
    queueRunner.preferredQueue.queue = [];
});