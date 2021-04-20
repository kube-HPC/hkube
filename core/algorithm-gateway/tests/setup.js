

before(async function () {
    this.timeout(15000)
    const bootstrap = require('../bootstrap');
    const config = await bootstrap.init();
    const baseUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    const restUrl = `${baseUrl}/${config.rest.prefix}`;
    global.testParams = {
        restUrl,
        config
    }
});