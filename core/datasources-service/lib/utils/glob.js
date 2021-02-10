const _glob = require('glob');

/** @type {(pattern: string, cwd: string) => Promise<string[]>} */
module.exports = (pattern, cwd) =>
    new Promise((res, rej) =>
        _glob(pattern, { cwd }, (err, matches) =>
            err ? rej(err) : res(matches)
        )
    );
