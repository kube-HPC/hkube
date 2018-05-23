const bootstrap = require('./bootstrap.js');

bootstrap.init().catch((error) => {
    console.error(error);
    process.exit(1);
});
