const { expect } = require('chai');
const sinon = require('sinon');
const axios = require('axios');
const https = require('https');
const KeycloakConnect = require('keycloak-connect');

const KeycloakMiddleware = require('../lib/service/keycloak');

describe('Keycloak Middleware', () => {
    const sandbox = sinon.createSandbox();
    const dummyRealmResponse = { data: { realm: 'test-realm' } };

    beforeEach(() => {
        sandbox.stub(KeycloakConnect.prototype, 'protect').returns(() => {});
        sandbox.stub(axios, 'get').resolves(dummyRealmResponse);
    });

    afterEach(() => {
        sandbox.restore();
    });

    after(() => {
        KeycloakMiddleware._options.enabled = false;
    });

    it('should trust self-signed certificates when allowInsecureTLS is true', async () => {
        const httpsSpy = sandbox.spy(https, 'Agent');

        await KeycloakMiddleware.init({
            keycloak: {
                enabled: true,
                clientId: 'test-client',
                clientSecret: 'dummy-secret',
                realm: 'test-realm',
                authServerUrl: 'https://my-local-keycloak',
                allowInsecureTLS: true,
                defaultUserAuditingName: 'defaultUser'
            }
        });

        expect(httpsSpy.calledWithMatch({ rejectUnauthorized: false })).to.equal(true);
        expect(axios.get.calledWithMatch(
            'https://my-local-keycloak/realms/test-realm',
            sinon.match.has('httpsAgent', sinon.match.instanceOf(https.Agent))
        )).to.equal(true);
    });

    it('should NOT use https.Agent when allowInsecureTLS is false', async () => {
        await KeycloakMiddleware.init({
            keycloak: {
                enabled: true,
                clientId: 'test-client',
                clientSecret: 'dummy-secret',
                realm: 'test-realm',
                authServerUrl: 'https://my-local-keycloak',
                allowInsecureTLS: false,
                defaultUserAuditingName: 'defaultUser'
            }
        });

        expect(axios.get.calledWith(
            'https://my-local-keycloak/realms/test-realm',
            {}
        )).to.equal(true);
    });
});
