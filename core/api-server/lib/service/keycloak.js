const Keycloak = require('keycloak-connect');
const Logger = require('@hkube/logger');

let log;
const component = 'Keycloak-Middleware';

class KeycloakMiddleware {
    constructor() {
        this._keycloak = null;
        this._options = null;
    }

    async init(options) {
        this._options = options.keycloak;
        log = Logger.GetLogFromContainer();
        log.info('Initializing Keycloak middleware...', { component });

        if (this._options.enabled) {
            this._keycloak = new Keycloak({}, {
                clientId: this._options.clientId,
                bearerOnly: this._options.bearerOnly,
                serverUrl: this._options.authServerUrl,
                realm: this._options.realm,
                credentials: {
                    secret: this._options.clientSecret
                }
            });
            log.info(`Keycloak initialized with options: ${JSON.stringify(this._options)}`, { component });
        }
        else {
            log.info(`Keycloak middleware wasn't initialized, it is ${JSON.stringify(this._options.enabled)}`, { component });
        }
    }

    getKeycloakInstance() {
        return this._keycloak;
    }

    protect(...roles) {
        if (!this._options.enabled) {
            log.warning('Keycloak middleware is not initialized.', { component });
            // throw new Error('Keycloak middleware is not initialized.');
            return (req, res, next) => {
                next();
            }; // Allow passthrough when not using keycloak
        }
        if (roles.length > 0) {
            log.info(`Protecting with roles: ${roles.join(', ')}`, { component });
            return this._keycloak.protect((token) => roles.some(role => token.hasRole(role)));
        }
        log.info('Protecting all requests without role restrictions.', { component });
        return this._keycloak.protect();
    }

    // Use this for auditing purposes
    async getUserInfo(req) {
        if (!this._keycloak) {
            log.error('Keycloak middleware is not initialized.', { component });
            throw new Error('Keycloak middleware is not initialized.');
        }
        const token = this._keycloak.getToken(req);
        if (!token) {
            log.warn('No token found in request.', { component });
            return null;
        }
        try {
            const userInfo = token.content;
            log.info(`Retrieved user info: ${JSON.stringify(userInfo)}`, { component });
            return userInfo;
        }
        catch (error) {
            log.error(`Failed to retrieve user info: ${error.message}`, { component });
            throw error;
        }
    }
}

module.exports = new KeycloakMiddleware();
