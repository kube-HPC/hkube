const configIt = require('@hkube/config');
const bootstrap = require('../bootstrap');
const config = configIt.load().main;
const datastoreFactory = require('../lib/helpers/datastoreHelper');

describe('bootstrap', () => {
    it('should init without error', async () => {
        await datastoreFactory.init(config, null, true);
        await bootstrap.init();
    }).timeout(5000);
});
