const bootstrap = require('./bootstrap');

bootstrap.init().catch((error) => {
    console.error(error);//eslint-disable-line
    process.exit(1);
});
