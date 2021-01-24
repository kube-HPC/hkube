/**
 * @param {{ name: string; path: string }} File
 * @param { string= } dataDir
 */
module.exports = ({ name, path }, dataDir = 'data') => {
    return path === '/'
        ? `${dataDir}/${name}`
        : // ensure there's no '/' at the end of a path
          `${dataDir}/${path.replace(/^\//, '')}/${name}`;
};
