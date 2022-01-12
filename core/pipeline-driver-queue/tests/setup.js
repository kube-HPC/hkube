const bootstrap = require('../bootstrap');
const persistence = require('../lib/persistency/persistence');

before(async () => {
    await bootstrap.init();
    await persistence.client._client.client.delete().all();
    global.consumer = require('../lib/jobs/consumer');
});