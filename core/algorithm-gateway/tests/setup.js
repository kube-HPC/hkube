

before(async function () {
    this.timeout(15000)
    const bootstrap = require('../bootstrap');
    const config = await bootstrap.init();
    const restUrl = `${config.swagger.protocol}://${config.swagger.host}:${config.swagger.port}`;
    global.testParams = {
        restUrl,
        config
    }
});