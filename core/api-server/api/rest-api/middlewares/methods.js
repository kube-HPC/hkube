const { MethodNotAllowed } = require('lib/errors/errors');

const method = (methods = ['GET']) => (req, res, next) => {
    if (methods.includes(req.method)) {
        return next();
    }
    res.set('Allow', methods.join(','));
    next(new MethodNotAllowed())
};

module.exports = method;