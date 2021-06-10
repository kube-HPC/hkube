const _glob = require('glob');

module.exports.glob = (pattern, cwd) => {
    return new Promise((res, rej) => {
        _glob(pattern, { cwd }, (err, matches) => {
            if (err) {
                return rej(err);
            }
            return res(matches);
        });
    });
};
