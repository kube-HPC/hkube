const { expect } = require('chai');
const HttpStatus = require('http-status-codes');
const { request } = require('./utils');

const keycloakHeaders = {
    authorization: `Bearer ${process.env.KEYCLOAK_TEST_TOKEN}`
};
const secondKeycloakHeaders = {
    authorization: `Bearer ${process.env.KEYCLOAK_TEST_TOKEN_2}`
};

let restUrl;
let preferencesPath;

const samplePreferences = {
    theme: 'dark',
    scoopIntervalHours: 24,
    tables: {
        jobs: {
            columns: {
                name: { visible: true, width: 200 },
                status: { visible: false, width: 120 }
            }
        },
        algorithms: { columns: {} },
        pipelines: { columns: {} }
    }
};

describe('Preferences', () => {
    before(function setupPreferences() {
        restUrl = global.testParams.restUrl;
        preferencesPath = `${restUrl}/preferences`;
        if (!global.testParams.config.keycloak.enabled || !process.env.KEYCLOAK_TEST_TOKEN || !process.env.KEYCLOAK_TEST_TOKEN_2) {
            return this.skip();
        }
        return null;
    });

    describe('GET /preferences', () => {
        it('should return empty object for new user', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: keycloakHeaders
            });
            expect(response.body).to.eql({});
        });

        it('should reject unauthenticated requests when Keycloak is enabled', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'GET'
            });
            expect(response.response.statusCode).to.equal(HttpStatus.StatusCodes.UNAUTHORIZED);
        });
    });

    describe('PUT /preferences', () => {
        it('should create preferences and return saved object', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: samplePreferences
            });
            expect(response.body.theme).to.equal('dark');
            expect(response.body.scoopIntervalHours).to.equal(24);
            expect(response.body.tables).to.deep.equal(samplePreferences.tables);
        });

        it('should replace existing preferences (full replacement)', async () => {
            const updatedPrefs = {
                theme: 'light',
                scoopIntervalHours: 1,
                tables: {
                    jobs: { columns: {} },
                    algorithms: { columns: {} },
                    pipelines: { columns: {} }
                }
            };
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: samplePreferences
            });
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: updatedPrefs
            });
            expect(response.body.theme).to.equal('light');
            expect(response.body.scoopIntervalHours).to.equal(1);
            expect(response.body.tables.jobs.columns).to.deep.equal({});
        });

        it('should reject unknown fields with a validation error', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { ...samplePreferences, extraField: 'should-be-rejected', hack: true }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('unknown preferences fields');
        });

        it('should reject invalid theme value', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { theme: 'blue' }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('theme');
        });

        it('should reject invalid scoopIntervalHours value', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { scoopIntervalHours: 5 }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('scoopIntervalHours');
        });

        it('should reject invalid tables type', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { tables: 'not-an-object' }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('tables');
        });

        it('should reject unknown table keys', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { tables: { unknownTable: { columns: {} } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('unknown tables keys');
        });

        it('should reject unknown column properties', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { tables: { jobs: { columns: { name: { visible: true, color: 'red' } } } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('unknown column properties');
        });

        it('should reject non-boolean visible', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { tables: { jobs: { columns: { name: { visible: 'yes' } } } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('visible must be a boolean');
        });

        it('should reject non-positive-integer width', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { tables: { jobs: { columns: { name: { width: -10 } } } } }
            });
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.contain('width must be a positive integer');
        });
    });

    describe('GET /preferences (after PUT)', () => {
        it('should return previously saved preferences', async () => {
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: samplePreferences
            });
            const response = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: keycloakHeaders
            });
            expect(response.body.theme).to.equal('dark');
            expect(response.body.scoopIntervalHours).to.equal(24);
            expect(response.body.tables).to.deep.equal(samplePreferences.tables);
        });
    });

    describe('DELETE /preferences', () => {
        it('should remove preferences and return empty object', async () => {
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: samplePreferences
            });
            const deleteResponse = await request({
                uri: preferencesPath,
                method: 'DELETE',
                headers: keycloakHeaders
            });
            expect(deleteResponse.body).to.eql({});

            const getResponse = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: keycloakHeaders
            });
            expect(getResponse.body).to.eql({});
        });

        it('should be idempotent (no error when nothing to delete)', async () => {
            const response = await request({
                uri: preferencesPath,
                method: 'DELETE',
                headers: keycloakHeaders
            });
            expect(response.body).to.eql({});
        });
    });

    describe('User isolation', () => {
        it('should keep preferences separate per authenticated user', async () => {
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: keycloakHeaders,
                body: { theme: 'dark' }
            });
            await request({
                uri: preferencesPath,
                method: 'PUT',
                headers: secondKeycloakHeaders,
                body: { theme: 'lightsOut' }
            });

            const responseA = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: keycloakHeaders
            });
            const responseB = await request({
                uri: preferencesPath,
                method: 'GET',
                headers: secondKeycloakHeaders
            });

            expect(responseA.body.theme).to.equal('dark');
            expect(responseB.body.theme).to.equal('lightsOut');
        });
    });
});
