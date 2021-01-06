const fs = require('fs');
const path = require('path');
const swaggerParser = require('swagger-parser');
const swaggerLoader = require('./swagger-loader');
const packageJson = require(`${process.cwd()}/package.json`);
const { version } = packageJson;
const FILE = 'swagger.json';

const build = async () => {
    const { schemasInternal, ...swagger } = await swaggerLoader.load({
        path: path.join(__dirname, 'swagger'),
    });
    swagger.info.version = version;
    await swaggerParser.validate(swagger);
    fs.writeFileSync(path.join(__dirname, FILE), JSON.stringify(swagger, null, 2));
    console.log(`successfully build ${FILE}`);
};

build();
