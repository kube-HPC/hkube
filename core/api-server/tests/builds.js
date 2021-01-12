const { expect } = require('chai');
const fse = require('fs-extra');
const nock = require('nock');
const { uid: uuid } = require('@hkube/uid');
const HttpStatus = require('http-status-codes');
const querystring = require('querystring');
const builds = require('../lib/service/builds');
const { request } = require('./utils');
const githubSample = require('./mocks/github-sample.json')
const gitlabSample = require('./mocks/gitlab-sample')
const commit = require('./mocks/github-commit.json');
let restUrl;

const baseApi = 'https://api.github.com';
const hkubeRepo = '/repos/kube-HPC/hkube-green/commits';

describe('Builds', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        nock(baseApi).persist().get(hkubeRepo).query(true).reply(HttpStatus.OK, commit.data);
    });
    describe('webhhoks/gitlab', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/webhook/gitlab`;
        });
        it.skip('should run simple gitlab push webhook', async () => {
            console.log(`restPath=${restPath}`)
            const options = {
                uri: restPath,
                body: gitlabSample,
                method: 'POST'
            };
            const res = await request(options);
            const body = res.body[0];
            console.log(res)
            expect(body).to.have.property('buildId');
        })
    });
    describe('status', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/status`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath + '/no_such_id',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('build no_such_id Not Found');
        });
        it('should throw validation error of required property buildId', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'buildId'");
        });
        it('should succeed to get build status', async () => {
            const payload = {
                name: `my-alg-${uuid()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath + `/${res.body.buildId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body).to.have.property('status');
            expect(response.body).to.have.property('startTime');
            expect(response.body).to.have.property('baseImage');
            expect(response.body.status).to.equal('pending');
        });
        it('should succeed to get baseImage', async () => {
            const payload = {
                name: `my-alg-${uuid()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs',
                baseImage: 'userOwnBaseImage'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath + `/${res.body.buildId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.baseImage).to.equal('userOwnBaseImage');
        });
        it('should succeed to get dependencyInstallCmd', async () => {
            const payload = {
                name: `my-alg-${uuid()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs',
                baseImage: 'userOwnBaseImage',
                dependencyInstallCmd: 'install.sh'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath + `/${res.body.buildId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.dependencyInstallCmd).to.equal('install.sh');
        });
        it('should work without dependencyInstallCmd', async () => {
            const payload = {
                name: `my-alg-${uuid()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs',
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath + `/${res.body.buildId}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.dependencyInstallCmd).to.not.exist;
        });
    });
    describe('stop', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/stop`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath,
                body: {
                    buildId: 'no_such_id'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('build no_such_id Not Found');
        });
        it('should throw validation error of required property buildId', async () => {
            const options = {
                uri: restPath
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'buildId'");
        });
        it('should succeed to stop build', async () => {
            const payload = {
                name: `my-alg-${uuid()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath,
                body: { buildId: res.body.buildId }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body.message).to.equal('OK');
        })
    });
    describe('rerun', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/rerun`;
        });
        it('should throw status Not Found with params', async () => {
            const options = {
                uri: restPath,
                body: {
                    buildId: 'no_such_id'
                }
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('build no_such_id Not Found');
        });
        it('should throw validation error of required property buildId', async () => {
            const options = {
                uri: restPath
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'buildId'");
        });
        it('should succeed to rerun build', async () => {
            const payload = {
                name: `my-alg-${uuid()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            }
            const formData = {
                payload: JSON.stringify(payload),
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const opt = {
                uri: restUrl + '/store/algorithms/apply',
                formData
            };
            const res = await request(opt);

            const options = {
                uri: restPath,
                body: { buildId: res.body.buildId }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('unable to rerun build because its in pending status');
        })
    });
    describe('list', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/list`;
        });
        it('should throw validation error of order property', async () => {
            const qs = querystring.stringify({ order: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.order should be equal to one of the allowed values");
        });
        it('should throw validation error of sort property', async () => {
            const qs = querystring.stringify({ sort: 'bla' });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain("data.sort should be equal to one of the allowed values");
        });
        it('should throw validation error of limit should be >= 1', async () => {
            const qs = querystring.stringify({ limit: 0 });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be >= 1");
        });
        it('should throw validation error of limit should be integer', async () => {
            const qs = querystring.stringify({ limit: "y" });
            const options = {
                uri: restPath + `/pipe?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.limit should be integer");
        });
        it('should succeed to get build list', async () => {
            const body = {
                name: `my-alg-${uuid()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.9.0',
                env: 'nodejs'
            };
            const payload = JSON.stringify(body);
            const formData1 = {
                payload,
                file: fse.createReadStream('tests/mocks/algorithm.zip')
            };
            const formData2 = {
                payload,
                file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
            };
            const uri = restUrl + '/store/algorithms/apply';
            const options1 = {
                uri,
                formData: formData1
            };
            const options2 = {
                uri,
                formData: formData2
            };

            await request(options1);
            await request(options2)

            const limit = 2;
            const qs = querystring.stringify({ sort: 'desc', limit });

            const options = {
                uri: `${restPath}/${body.name}?${qs}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.OK);
            expect(response.body).to.have.lengthOf(limit);
            expect(response.body[0]).to.have.property('status');
            expect(response.body[0]).to.have.property('startTime');
            expect(response.body[0].status).to.equal('pending');

            expect(response.body[1]).to.have.property('status');
            expect(response.body[1]).to.have.property('startTime');
            expect(response.body[1].status).to.equal('pending');
        })
    });
    describe('fileInfo', () => {
        it('should success to extract fileInfo', async () => {
            const fileInfo = await builds._fileInfo({ name: 'algorithm.tar.gz', path: 'tests/mocks/algorithm.tar.gz' });
            expect(fileInfo).to.have.property('fileExt');
            expect(fileInfo).to.have.property('checksum');
            expect(fileInfo).to.have.property('fileSize');
            expect(fileInfo.fileExt).to.equal('gz');
            expect(fileInfo.checksum).to.be.string;
            expect(fileInfo.fileSize).to.equal(740);
        });
    });
    describe('webhhoks/github', () => {
        let restPath = null;
        before(() => {
            restPath = `${restUrl}/builds/webhook/github`;
        });
        it('should run simple push webhook', async () => {
            const options = {
                uri: restPath,
                body: { payload: JSON.stringify(githubSample) },
                method: 'POST'
            };
            const res = await request(options);
            const body = res.body[0];
            expect(body).to.have.property('buildId');
        })
    });
});
