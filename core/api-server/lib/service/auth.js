const axios = require('axios');
const validator = require('../validation/api-validator');

let keycloakConfig;

class AuthService {
    init(config) {
        keycloakConfig = config.keycloak;
    }

    async login({ username, password }) {
        this._validate({ username, password });
        const response = await axios.post(
            `${keycloakConfig.authServerUrl}/realms/${keycloakConfig.realm}/protocol/openid-connect/token`,
            new URLSearchParams({
                client_id: keycloakConfig.clientId,
                client_secret: keycloakConfig.clientSecret,
                grant_type: 'password',
                username,
                password
            })
        );
        const token = response.data.access_token;
        return token;
    }

    _validate(options) {
        validator.auth.validateLogin(options);
    }
}

module.exports = new AuthService();
