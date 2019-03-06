const configIt = require('@hkube/config');
const bootstrap = require('../bootstrap');
const config = configIt.load().main;
const storageManager = require('@hkube/storage-manager');

describe('bootstrap', () => {
    it('should init without error', async () => {
        await storageManager.init(config, null, true);
        await bootstrap.init();
    }).timeout(5000);
});
