const { expect } = require('chai');
const { StatusCodes } = require('http-status-codes');
const { request } = require('./utils');
const { devenvStatuses, devenvTypes } = require('@hkube/consts');
const { randomString } = require('@hkube/uid');
const stateManager = require('../lib/state/state-manager');

let restDevenvPath;

describe('Devenvs', () => {
    before(() => {
        restDevenvPath = global.testParams.restUrl + '/devenv';
    });
    describe('get', () => {
        let restPath = null;
        before(() => {
            restPath = `${restDevenvPath}/`;
        });
        it('should throw Not Found with params', async () => {
            const options = {
                uri: restPath + 'no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(StatusCodes.NOT_FOUND);
            expect(response.body.error.message).to.equal('devenv no_such_id Not Found');
        });
        it('should get after create', async () => {
            const name = randomString();
            let options = {
                uri: `${restDevenvPath}/`,
                method: 'POST',
                body: {
                    name,
                    type: devenvTypes.JUPYTER
                }
            };
            let response = await request(options);
            options = {
                uri: `${restPath}/${name}`,
                method: 'GET'
            };
            response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.OK);
            expect(response.body).to.eql({
                name,
                type: devenvTypes.JUPYTER,
                status: devenvStatuses.PENDING
            });
        });
    });
    describe('create', () => {
        before(() => {
            restPath = `${restDevenvPath}/`;
        });
        it('create jupyter devenv should succeed', async () => {
            const name = randomString();
            const options = {
                uri: `${restDevenvPath}/`,
                method: 'POST',
                body: {
                    name,
                    type: devenvTypes.JUPYTER
                }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.OK);
            expect(response.body).to.eql({...options.body, status: devenvStatuses.PENDING});
        });
        it('create vscode devenv should succeed', async () => {
            const name = randomString();
            const options = {
                uri: `${restDevenvPath}/`,
                method: 'POST',
                body: {
                    name,
                    type: devenvTypes.VSCODE
                }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.OK);
            expect(response.body).to.eql({...options.body, status: devenvStatuses.PENDING});
        });
        it('creating devenv should fail if invalid type', async () => {
            const name = randomString();
            const options = {
                uri: `${restDevenvPath}/`,
                method: 'POST',
                body: {
                    name,
                    type: 'no-such-type'
                }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.BAD_REQUEST);
            expect(response.body.error.message).to.eql('data.type should be equal to one of the allowed values (Jupyter,Vscode)');
        });
        it('creating with same name should fail', async () => {
            const name = randomString();
            const options = {
                uri: `${restDevenvPath}/`,
                method: 'POST',
                body: {
                    name,
                    type: devenvTypes.JUPYTER
                }
            };
            await request(options);
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.CONFLICT);
            expect(response.body.error.message).to.eql(`devenv ${name} already exists`);
        });
    });
    describe('delete', () => {
        let restPath = null;
        before(() => {
            restPath = `${restDevenvPath}/`;
        });
        it('should return no deleted if devenv does not exist', async () => {
            const name = randomString();
            const options = {
                uri: `${restDevenvPath}/no-such-env`,
                method: 'DELETE',
                
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.NOT_FOUND);
        });
        it('should delete one', async () => {
            const name = randomString();
            let options = {
                uri: `${restDevenvPath}/`,
                method: 'POST',
                body: {
                    name,
                    type: devenvTypes.JUPYTER
                }
            };
            const createResponse = await request(options);
            options = {
                uri: `${restDevenvPath}/${name}`,
                method: 'DELETE',
                
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.OK);
            expect(response.body).to.eql({name, status: devenvStatuses.DELETING});
        });
        
    });

    describe('list', () => {
        before(() => {
            restPath = `${restDevenvPath}/`;
        });
        beforeEach(async ()=>{
            stateManager.deleteDevenv({});
        })
        it('should return empty list', async () => {
            const options = {
                uri: `${restDevenvPath}/list`,
                method: 'GET',
                
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.OK);
            expect(response.body).to.eql([]);
        });
        it('should delete one', async () => {
            const names = Array.from({length: 10}, () => randomString());
            await Promise.all(names.map(name => {
                const createOptions = {
                    uri: `${restDevenvPath}/`,
                    method: 'POST',
                    body: {
                        name,
                        type: devenvTypes.JUPYTER
                    }
                };
                return request(createOptions);
            }));
            const options = {
                uri: `${restDevenvPath}/list`,
                method: 'GET',
                
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(StatusCodes.OK);
            expect(response.body.length).to.eql(10);
            expect(response.body.map(item => item.name).sort()).to.eql(names.sort());
        });
        
    });
});
