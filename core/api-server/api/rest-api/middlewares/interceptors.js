class RequestInterceptor {
    constructor() {
        this._ingressPath = null;
        this._internalRoutePattern = null;
    }

    async init(options) {
        this._options = options;
        this._ingressPath = this._options.interceptor.apiIngressPath.replace(/\/+$/, '');
        this._internalRoutePattern = new RegExp(`^${this._ingressPath}/internal(\\/|$)`);
    }

    blockInternalFromIngress(req, res, next) {
        const cleanedPath = req?.path?.replace(/\/+$/, '') || '';

        if (this._internalRoutePattern.test(cleanedPath)) {
            return res.status(403).json({ error: 'Forbidden' });
        }

        return next();
    }
}

module.exports = new RequestInterceptor();
