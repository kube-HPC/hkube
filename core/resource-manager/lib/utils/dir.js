const fs = require('fs');
const path = require('path');

const readdirSync = (dirname) => {
    return fs.readdirSync(path.join(dirname)).map(name => path.join(dirname, name)).filter(source => fs.lstatSync(source).isDirectory());
};

module.exports = {
    readdirSync
};
