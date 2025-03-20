const Keycloak = require('keycloak-connect');
const axios = require('axios');
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

            try {
                // Validate realm configuration by fetching the realm info
                const realmInfoUrl = `${this._options.authServerUrl}/realms/${this._options.realm}`;
                const response = await axios.get(realmInfoUrl);
                log.info(`Keycloak realm '${response.data.realm}' validated successfully.`, { component });
            }
            catch (error) {
                log.error(`Failed to validate Keycloak realm '${this._options.realm}': ${error.message}`, { component });
                throw new Error(`Invalid Keycloak realm configuration: ${error.message}`);
            }

            log.info(`Keycloak initialized with options: ${JSON.stringify(this._options)}`, { component });
        }
        else {
            log.info(`Keycloak middleware wasn't initialized, it is ${JSON.stringify(this._options.enabled)}`, { component });
        }
    }

    getKeycloakInstance() {
        return this._keycloak;
    }

    getProtect(roles) {
        return (req, res, next) => {
            if (!this._options.enabled) {
                return next();
            }
            // If roles are undefined or an empty array, treat it as no role protection
            if (!roles || roles.length === 0) {
                log.info('No roles provided, protecting route without role restrictions.', { component });
                return this._keycloak.protect()(req, res, next);
            }

            // Directly call the keycloak.protect() method with multiple roles
            return this._keycloak.protect(roles)(req, res, next);
        };
    }

    // Use this for auditing purposes
    getPreferredUsername(req) {
        if (!this._keycloak) {
            // log.error('Keycloak middleware is not initialized.', { component });
            return this._options.defaultUserAuditingName;
        }
        try {
            if (req?.kauth) {
                const userName = req.kauth.grant.access_token.content.preferred_username;
                return userName;
            }
            return null;
        }
        catch (error) {
            log.error(`Failed to retrieve user info: ${error.message}`, { component });
            throw error;
        }
    }
}

module.exports = new KeycloakMiddleware();
