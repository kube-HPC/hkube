const { ResourceNotFoundError, InvalidDataError } = require('../errors');
const NOT_FOUND_CODES = ['ENOENT', 'EISDIR'];

const handleStorageError = (error, type, path) => {
    if (error.statusCode === 404 || NOT_FOUND_CODES.includes(error.code)) {
        return new ResourceNotFoundError(type, path, error.message);
    }
    return new InvalidDataError(error.message);
};

const handleStreamError = (err, path, res, next) => {
    res.removeHeader('Content-disposition');
    res.removeHeader('Content-type');
    next(handleStorageError(err, 'stream', path));
};

const promisifyStream = (res, stream) => new Promise((resolve, reject) => {
    stream.on('close', () => resolve());
    stream.on('error', e => reject(e));
    stream.pipe(res);
});

const downloadApi = async (res, stream, ext) => {
    res.setHeader('Content-disposition', `attachment; filename=hkube-result${ext ? `.${ext}` : ''}`);
    res.setHeader('Content-type', 'application/octet-stream');
    await promisifyStream(res, stream);
};

module.exports = {
    handleStorageError,
    handleStreamError,
    promisifyStream,
    downloadApi,
};
