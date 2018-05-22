const bootstrap = require('./bootstrap.js');

bootstrap.init().catch((error) => {
    console.error(error); // eslint-disable-line
    process.exit(1);
});
