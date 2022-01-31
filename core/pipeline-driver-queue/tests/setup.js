const bootstrap = require('../bootstrap');

before(async function () {
    await bootstrap.init();
});