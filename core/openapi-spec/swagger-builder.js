const path = require('path');
const { swaggerUtils } = require('@hkube/rest-server');
const FILE = 'swagger.json';

const build = async () => {
    console.log('starting to build swagger');
    await swaggerUtils.builder.build({
        src: path.join(__dirname, 'swagger'),
        dest: path.join(__dirname, FILE),
    });
};

build();
