const RestServer = require('@hkube/rest-server');
const HttpStatus = require('http-status-codes');
const keycloak = require('../../../../lib/service/keycloak');
const stateManager = require('../../../../lib/state/state-manager');
const validator = require('../../../../lib/validation/api-validator');

const routes = () => {
    const router = RestServer.router();

    router.get('/', keycloak.getProtect(), async (req, res, next) => {
        try {
            const authenticatedUserId = keycloak.getUserId(req);
            if (!authenticatedUserId) {
                return res.status(HttpStatus.StatusCodes.BAD_REQUEST).json({ error: 'User identification required' });
            }
            const preferences = await stateManager.getPreferences(authenticatedUserId);
            return res.json(preferences);
        }
        catch (e) {
            return next(e);
        }
    });

    router.put('/', keycloak.getProtect(), async (req, res, next) => {
        try {
            const userId = keycloak.getUserId(req);
            if (!userId) {
                return res.status(HttpStatus.StatusCodes.BAD_REQUEST).json({ error: 'User identification required' });
            }
            validator.preferences.validatePreferences(req.body);
            const saved = await stateManager.setPreferences(userId, req.body);
            return res.json(saved);
        }
        catch (e) {
            return next(e);
        }
    });

    router.delete('/', keycloak.getProtect(), async (req, res, next) => {
        try {
            const userId = keycloak.getUserId(req);
            if (!userId) {
                return res.status(HttpStatus.StatusCodes.BAD_REQUEST).json({ error: 'User identification required' });
            }
            const result = await stateManager.deletePreferences(userId);
            return res.json(result);
        }
        catch (e) {
            return next(e);
        }
    });

    return router;
};

module.exports = routes;
