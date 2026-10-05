const RestServer = require('@hkube/rest-server');
const HttpStatus = require('http-status-codes');
const keycloak = require('../../../../lib/service/keycloak');
const stateManager = require('../../../../lib/state/state-manager');
const validator = require('../../../../lib/validation/api-validator');

const routes = () => {
    const router = RestServer.router();

    router.get('/', keycloak.getProtect(), async (req, res, next) => {
        try {
            const authenticatedUsername = keycloak.getUsername(req);
            if (!authenticatedUsername) {
                return res.status(HttpStatus.StatusCodes.BAD_REQUEST).json({ error: 'User identification required' });
            }
            const preferences = await stateManager.getPreferences(authenticatedUsername);
            return res.json(preferences);
        }
        catch (e) {
            return next(e);
        }
    });

    router.put('/', keycloak.getProtect(), async (req, res, next) => {
        try {
            const username = keycloak.getUsername(req);
            if (!username) {
                return res.status(HttpStatus.StatusCodes.BAD_REQUEST).json({ error: 'User identification required' });
            }
            validator.preferences.validatePreferences(req.body);
            const saved = await stateManager.setPreferences(username, req.body);
            return res.json(saved);
        }
        catch (e) {
            return next(e);
        }
    });

    router.delete('/', keycloak.getProtect(), async (req, res, next) => {
        try {
            const username = keycloak.getUsername(req);
            if (!username) {
                return res.status(HttpStatus.StatusCodes.BAD_REQUEST).json({ error: 'User identification required' });
            }
            const result = await stateManager.deletePreferences(username);
            return res.json(result);
        }
        catch (e) {
            return next(e);
        }
    });

    return router;
};

module.exports = routes;
