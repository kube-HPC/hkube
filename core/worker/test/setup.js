const configIt = require('@hkube/config');
const bootstrap = require('../bootstrap');
const config = configIt.load().main;
const storageManager = require('@hkube/storage-manager');
const workerCommunication = require('../lib/algorithm-communication/workerCommunication');

before(async function () {
    this.timeout(5000);
    await storageManager.init(config, null, true);
    await bootstrap.init();
    workerCommunication.adapter.start();
})
