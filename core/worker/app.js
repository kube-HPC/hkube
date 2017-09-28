const bootstrap = require('./bootstrap');

bootstrap.init()
    .catch(error=>{
        console.error(error);
        process.exit();
    });