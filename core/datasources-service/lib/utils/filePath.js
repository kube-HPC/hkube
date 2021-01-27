const { parse: parsePath } = require('path');

/**
 * @param {{ name: string; path: string }} File
 * @param { string= } dataDir
 */
const getFilePath = ({ name, path }, dataDir = 'data') =>
    path === '/'
        ? `${dataDir}/${name}`
        : // ensure there's no '/' at the end of a path
          `${dataDir}/${path.replace(/^\//, '')}/${name}`;

const extractRelativePath = filePath => {
    const response = parsePath(filePath.replace('data/', '')).dir;
    if (response === '') return '/';
    return `/${response}`;
};

module.exports = {
    getFilePath,
    extractRelativePath,
};
