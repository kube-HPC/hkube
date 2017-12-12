const bootstrap = require('../bootstrap');

describe('bootstrap', () => {
    it('should init without error', async () => {
        await bootstrap.init();
    });
});
