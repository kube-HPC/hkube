const { MethodNotAllowed } = require('../../../lib/errors');

const method = (methods = ['GET']) => (req, res, next) => {
    if (methods.includes(req.method)) {
        return next();
    }
    res.set('Allow', methods.join(','));
    return next(new MethodNotAllowed());
};

module.exports = method;
