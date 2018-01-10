/**
 * Created by nassi on 15/10/15.
 * The main entry point of the application
 * which starts the bootstrap module
 */

'use strict';

const bootstrap = require('./bootstrap');

bootstrap.init().catch((error) => {
    console.error(error); // eslint-disable-line
    process.exit(1);
});
