const { requestCleanup } = require('./utils');

describe('cleanup', () => {
    it.only('should call cleanup', async () => {
        await requestCleanup();
    });
});
