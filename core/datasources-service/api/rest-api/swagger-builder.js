const path = require('path');
const { swaggerUtils } = require('@hkube/rest-server');
const FILE = 'swagger.json';

const build = async () => {
    return swaggerUtils.builder.build({
        src: path.join(__dirname, 'swagger'),
        dest: path.join(__dirname, FILE),
    });
};

build();
