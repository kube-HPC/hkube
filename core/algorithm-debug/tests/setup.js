

before(async function () {
    this.timeout(15000)
    const bootstrap = require('../bootstrap');
    await bootstrap.init();
});