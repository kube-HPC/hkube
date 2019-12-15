const { expect } = require('chai');
const fse = require('fs-extra');
const { randomString: uuid } = require('../lib/utils');
const HttpStatus = require('http-status-codes');
const stateManager = require('../lib/state/state-manager');
const validationMessages = require('../lib/consts/validationMessages.js');
const { MESSAGES } = require('../lib/consts/builds');
const { algorithms } = require('./mocks');
const { request, defaultProps } = require('./utils');
let restUrl, restPath, applyPath;

const gitRepo = 'https://github.com/kube-HPC/hkube';

describe('Store/Algorithms', () => {
    before(() => {
        restUrl = global.testParams.restUrl;
        restPath = `${restUrl}/store/algorithms`;
        applyPath = `${restPath}/apply`;
    });
    describe('/store/algorithms:name GET', () => {
        it('should throw error algorithm not found', async () => {
            const options = {
                uri: restPath + '/not_exists',
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('algorithm not_exists Not Found');
        });
        it('should return specific algorithm', async () => {
            const body = {
                name: "test-alg",
                algorithmImage: "hkube/algorithm-example",
                cpu: 1,
                mem: "5000Ki"
            };
            const options = {
                uri: restPath,
                body
            };
            await request(options);

            const getOptions = {
                uri: restPath + '/test-alg',
                method: 'GET'
            };
            const response = await request(getOptions);
            expect(response.body).to.deep.equal({
                ...defaultProps,
                ...body
            });
        });
    });
    describe('/store/algorithms:name DELETE', () => {
        it('should throw error algorithm not found', async () => {
            const algorithmName = `delete-${uuid()}`;
            const options = {
                uri: `${restPath}/${algorithmName}`,
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal(`algorithm ${algorithmName} Not Found`);
        });
        it('should throw error on related data', async () => {
            const algorithmName = `delete-${uuid()}`;
            const algorithm = {
                uri: restPath,
                body: {
                    name: algorithmName,
                    algorithmImage: "image"
                }
            };
            const store = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: `delete-${uuid()}`,
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName,
                            input: []
                        }

                    ]
                }
            };
            const exec = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: store.body.name
                }
            };

            const resAlg = await request(algorithm);
            await request(store);
            await request(exec);
            await stateManager.setAlgorithmVersion(resAlg.body);
            await stateManager.setBuild({ buildId: `${algorithmName}-1`, algorithmName });
            await stateManager.setBuild({ buildId: `${algorithmName}-2`, algorithmName });

            const optionsDelete = {
                uri: `${restPath}/${algorithmName}?force=false`,
                method: 'DELETE'
            };
            const response = await request(optionsDelete);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.contain('you must first delete all related data');
        });
        it('should delete algorithm with related data', async () => {
            const algorithmName = `delete-${uuid()}`;
            const algorithm = {
                uri: restPath,
                body: {
                    name: algorithmName,
                    algorithmImage: "image"
                }
            };
            const store = {
                uri: `${restUrl}/store/pipelines`,
                body: {
                    name: `delete-${uuid()}`,
                    nodes: [
                        {
                            nodeName: 'green',
                            algorithmName,
                            input: []
                        }

                    ]
                }
            };
            const exec = {
                uri: `${restUrl}/exec/stored`,
                body: {
                    name: store.body.name
                }
            };

            const resAlg = await request(algorithm);
            await request(store);
            await request(exec);
            await stateManager.setAlgorithmVersion(resAlg.body);
            await stateManager.setBuild({ buildId: `${algorithmName}-1`, algorithmName });
            await stateManager.setBuild({ buildId: `${algorithmName}-2`, algorithmName });

            const optionsDelete = {
                uri: `${restPath}/${algorithmName}?force=true`,
                method: 'DELETE'
            };
            const response = await request(optionsDelete);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.contain('related data deleted');
        });
        it('should delete specific algorithm without related data', async () => {
            const optionsInsert = {
                uri: restPath,
                body: {
                    name: 'delete',
                    algorithmImage: 'image'
                }
            };
            await request(optionsInsert);

            const options = {
                uri: restPath + '/delete',
                method: 'DELETE'
            };
            const response = await request(options);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.contain('successfully deleted from store');
        });
    });
    describe('/store/algorithms GET', () => {
        it('should success to get list of algorithms', async () => {
            const options = {
                uri: restPath,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.be.an('array');
        });
    });
    describe('/store/algorithms POST', () => {
        it('should throw validation error of required property name', async () => {
            const options = {
                uri: restPath,
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should throw validation error of long algorithm name', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: 'this-is-33-length-algorithm--name'
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data.name should NOT be longer than 32 characters");
        });
        it('should throw validation error of data.name should be string', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: {}
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should be string');
        });
        it('should throw validation error of memory min 4 Mi', async () => {
            const body = {
                name: uuid(),
                algorithmImage: "image",
                mem: "3900Ki",
                cpu: 1
            }
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
        });
        it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: ''
                }
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
        });
        it('should throw conflict error', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: "conflict",
                    algorithmImage: "image"
                }
            };
            await request(options);
            const response = await request(options);
            expect(response.response.statusCode).to.equal(409);
            expect(response.body).to.have.property('error');
            expect(response.body.error.message).to.equal('algorithm conflict already exists');
        });
        const invalidChars = ['/', '_', '*', '#', '"', '%', 'A'];
        invalidChars.forEach((v) => {
            it(`should throw invalid algorithm name if include ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `notvalid${v}name`,
                        algorithmImage: "image"
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_NAME_FORMAT);
            });
        });
        const invalidStartAndEndChars = ['/', '_', '*', '#', '"', '%', '-', 'A'];
        invalidStartAndEndChars.forEach((v) => {
            it(`should throw invalid if algorithm name if start with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `${v}notvalidname`,
                        algorithmImage: "image"
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_NAME_FORMAT);
            });
            it(`should throw invalid if algorithm name if end with ${v}`, async () => {
                const options = {
                    uri: restPath,
                    body: {
                        name: `notvalidname${v}`,
                        algorithmImage: "image"
                    }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_NAME_FORMAT);
            });
        });
        it('should failed to store algorithm with no name', async () => {
            const body = {};
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal("data should have required property 'name'");
        });
        it('should failed to store algorithm with no image', async () => {
            const body = {
                name: uuid()
            }
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('cannot apply algorithm due to missing image url or build data');
        });
        it('should failed to store algorithm with end whitespace image name', async () => {
            const body = {
                name: uuid(),
                algorithmImage: 'image ',
            }
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_IMAGE_FORMAT);
        });
        it('should failed to store algorithm with start whitespace image name', async () => {
            const body = {
                name: uuid(),
                algorithmImage: ' image',
            }
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_IMAGE_FORMAT);
        });
        it('should failed to store algorithm with middle whitespace image name', async () => {
            const body = {
                name: uuid(),
                algorithmImage: 'image name',
            }
            const options = { uri: restPath, body };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal(validationMessages.ALGORITHM_IMAGE_FORMAT);
        });
        it('should succeed to store algorithm with name of 32 characters', async () => {
            const options = {
                uri: restPath,
                body: {
                    name: `this-is-32-length-algorithm-${uuid()}`,
                    algorithmImage: 'image-name',
                }
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.CREATED);
            expect(response.body).to.deep.equal({
                ...defaultProps,
                ...options.body
            });
        });
        it('should succeed to store algorithm name (www.example.com)', async () => {
            const body = {
                name: '2-www.exam-ple.com' + uuid(),
                algorithmImage: "image",
                mem: "50Mi",
                cpu: 1
            }
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.CREATED);
            expect(response.body).to.deep.equal({
                ...defaultProps,
                ...body
            });
        });
        it('should succeed to store and get multiple algorithms', async function () {
            this.timeout(10000);
            const limit = 5;
            const keys = Array.from(Array(limit).keys());
            const algorithms = keys.map(k => ({
                ...defaultProps,
                name: `stress-${k}-${uuid()}`,
                algorithmImage: "image",
                mem: "50Mi",
                cpu: k
            }));

            const result = await Promise.all(algorithms.map(a => request({ uri: restPath, body: a })));

            result.forEach((r, i) => {
                expect(r.body).to.deep.equal(algorithms[i]);
            });

            const options = {
                uri: `${restPath}?name=stress&limit=${limit}`,
                method: 'GET'
            };
            const response = await request(options);
            expect(response.body).to.has.lengthOf(limit);
            await stateManager._etcd.algorithms.store.delete({ name: 'stress' }, { isPrefix: true })
        });
        it('should succeed to store algorithm', async () => {
            const body = {
                name: uuid(),
                algorithmImage: "image",
                mem: "50Mi",
                cpu: 1,
                type: "Image"
            }
            const options = {
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.response.statusCode).to.equal(HttpStatus.CREATED);
            expect(response.body).to.deep.equal({
                ...defaultProps,
                ...body
            });
        });
    });
    describe('/store/algorithms/apply POST', () => {
        describe('Validation', () => {
            it('should throw validation error of required property name', async () => {
                const options = {
                    uri: applyPath,
                    formData: {}
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal("data should have required property 'name'");
            });
            it('should throw validation error of data.name should be string', async () => {
                const payload = JSON.stringify({ name: {} });
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('data.name should be string');
            });
            it('should throw validation error of memory min 4 Mi', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: "image",
                    mem: "3900Ki",
                    cpu: 1
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
            });
            it('should throw validation error of name should NOT be shorter than 1 characters"', async () => {
                const payload = JSON.stringify({ name: '' });
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal('data.name should NOT be shorter than 1 characters');
            });
            it('should throw validation invalid env', async () => {
                const body = {
                    name: uuid(),
                    algorithmImage: "image",
                    mem: "3900Ki",
                    cpu: 1,
                    env: "no_such"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    formData: { payload }
                };
                const response = await request(options);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.contain('data.env should be equal to one of the allowed values');
            });
            it('should throw validation invalid fileExt', async () => {
                const payload = {
                    name: `my-alg-${uuid()}`,
                    mem: "50Mi",
                    cpu: 1,
                    version: '1.9.0'
                }
                const formData = {
                    payload: JSON.stringify(payload),
                    file: fse.createReadStream('tests/mocks/algorithm.tar')
                };
                const options = {
                    uri: restPath + '/apply',

                    formData
                };
                const response = await request(options);
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body).to.have.property('error');
                expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.contain('data.fileExt should be equal to one of the allowed values');
            });
            it('should throw error of missing image and file', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: "50Mi",
                    cpu: 1
                };
                const formData = {
                    payload: JSON.stringify(body)
                };
                const options = {
                    uri: applyPath,
                    formData
                };

                const response = await request(options)
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(MESSAGES.APPLY_ERROR);
            });
            it('should throw error of having image and file', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'image',
                    mem: "50Mi",
                    cpu: 1,
                    env: 'python'
                };
                const formData = {
                    payload: JSON.stringify(body),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const options = {
                    uri: applyPath,
                    formData
                };

                const response = await request(options)
                expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
                expect(response.body.error.message).to.equal(MESSAGES.FILE_AND_IMAGE);
            });
            it('should not throw error when git repo was not supplied', async () => {
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    type: "Git",
                    mem: "50Mi",
                    cpu: 1
                }
                const uri = restPath + '/apply';
                const req = { uri, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req)
                expect(res.response.statusCode).to.equal(HttpStatus.OK);
                expect(res.body).to.not.have.property('buildId');
            });
            it('should not throw error when file was not supplied', async () => {
                const apply = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    type: "Code",
                    mem: "50Mi",
                    cpu: 1
                }
                const uri = restPath + '/apply';
                const req = { uri, formData: { payload: JSON.stringify(apply) } };
                const res = await request(req)
                expect(res.response.statusCode).to.equal(HttpStatus.OK);
                expect(res.body).to.not.have.property('buildId');
            });
            it('should throw validation error of algorithm type cannot be changed', async () => {
                const url = 'https://github.com/hkube.gits/my.git.foo.bar.git';
                const body1 = {
                    name: uuid(),
                    gitRepository: {
                        url,
                    },
                    env: 'nodejs',
                    type: "Git"
                }
                const body2 = {
                    ...body1,
                    type: "Code"
                }
                const options1 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body1) }
                };
                const options2 = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body2) }
                };
                const res1 = await request(options1);
                const res2 = await request(options2);
                expect(res1.body).to.have.property('buildId');
                expect(res2.body).to.have.property('error');
                expect(res2.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res2.body.error.message).to.contain(`algorithm type cannot be changed, new type: ${body2.type}, old type: ${body1.type}`);
            });
        });
        describe('Github', () => {
            it('should throw error of required property url', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`data.gitRepository should have required property 'url'`);
            });
            it('should throw error of match format url', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url: ''
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`data.gitRepository.url should match format "url"`);
            });
            it('should throw error of url not found', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url: 'http://no_such_url'
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`invalid url 'http://no_such_url'`);
            });
            it('should throw error of branch not found', async () => {
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url: 'http://no_such_url',
                        branchName: "no_such"
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`invalid url 'http://no_such_url'`);
            });
            it('should throw error of git repository is empty', async () => {
                const url = 'https://github.com/hkube/empty';
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url,
                    },
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(`Git Repository is empty. (${url})`);
            });
            it('should throw error of both image and git is not allowed', async () => {
                const url = 'https://github.com/hkube.gits/my.git.foo.bar.git';
                const body = {
                    name: uuid(),
                    algorithmImage: 'my-image',
                    gitRepository: {
                        url
                    },
                    env: 'nodejs',
                    type: "Git"
                }
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const res = await request(options);
                expect(res.body).to.have.property('error');
                expect(res.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
                expect(res.body.error.message).to.equal(MESSAGES.GIT_AND_IMAGE);
            });
            it('should create build with last commit data', async () => {
                const url = 'https://github.com/hkube.gits/my.git.foo.bar.git';
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url,
                        token: '1111',
                        gitKind: "github"
                    },
                    env: 'nodejs',
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body).to.have.property('buildId');
            });
            it('should create build with last commit data', async () => {
                const name = uuid();
                const body = {
                    name,
                    mem: "6000Mi",
                    cpu: 1,
                    gitRepository: {
                        url: gitRepo
                    },
                    env: "nodejs"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body).to.have.property('buildId');
            });
            it('should not trigger new build if same commit id', async () => {
                const body = {
                    name: uuid(),
                    gitRepository: {
                        url: gitRepo
                    },
                    env: "nodejs",
                    type: "Git"
                }
                const options = {
                    uri: applyPath,
                    body: { payload: JSON.stringify(body) }
                };
                const res1 = await request(options);
                expect(res1.body).to.have.property('buildId');

                const res2 = await request(options);
                expect(res2.body).to.not.have.property('buildId');
            });
        });
        describe('Code', () => {
            it('should succeed to apply algorithm with first build', async () => {
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
                const options = {
                    uri: restPath + '/apply',
                    formData
                };
                const response = await request(options);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.have.property('buildId');
                expect(response.body).to.have.property('messages');
                expect(response.body.messages[0]).to.equal(MESSAGES.FIRST_BUILD);

                const getOptions = {
                    uri: restPath + '/' + payload.name,
                    method: 'GET'
                };
                const algResponse = await request(getOptions);
                expect(algResponse.body.fileInfo).to.have.property('fileExt');
                expect(algResponse.body.fileInfo).to.have.property('checksum');
                expect(algResponse.body.fileInfo).to.have.property('fileSize');
            });
            it('should succeed to apply algorithm without buildId in response', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: "50Mi",
                    cpu: 1
                }
                const body1 = {
                    ...body,
                    version: '1.8.0',
                    env: 'nodejs',
                    type: 'Code'
                }
                const body2 = {
                    ...body,
                    version: '1.8.0',
                    env: 'nodejs',
                    cpu: 2
                }
                const options = {
                    uri: restPath,
                    body: body1
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const uri = restPath + '/apply';
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };
                // insert algorithm
                await request(options);

                // apply algorithm
                await request(options1)

                // apply algorithm again
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.not.have.property('buildId');
                expect(response.body.messages[0]).to.equal(MESSAGES.NO_TRIGGER_FOR_BUILD);
            });
            it('should succeed to apply algorithm with buildId due to change in env', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: "50Mi",
                    cpu: 1
                }
                const body1 = {
                    ...body,
                    version: '1.8.0',
                    env: 'nodejs',
                    type: 'Code'
                }
                const body2 = {
                    ...body,
                    version: '1.9.0',
                    env: 'python'
                }
                const options = {
                    uri: restPath,
                    body: body1
                };
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const uri = restPath + '/apply';
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };
                // insert algorithm
                await request(options);

                // apply algorithm
                await request(options1)

                // apply algorithm again
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.have.property('buildId');
                expect(response.body.messages[0]).to.contains('a build was triggered due to change in env');
            });
            it('should succeed to apply algorithm without buildId in response', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: "50Mi",
                    cpu: 1,
                    version: '1.8.0',
                    env: 'nodejs',
                    type: 'Code'
                }
                const body1 = {
                    ...body,
                    cpu: 1
                }
                const body2 = {
                    ...body,
                    cpu: 2
                }
                const formData1 = {
                    payload: JSON.stringify(body1),
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload: JSON.stringify(body2)
                };
                const uri = restPath + '/apply';
                const options1 = {
                    uri,
                    formData: formData1
                };
                const options2 = {
                    uri,
                    formData: formData2
                };

                // apply algorithm
                await request(options1)

                // apply algorithm again
                const response = await request(options2);
                expect(response.response.statusCode).to.equal(HttpStatus.OK);
                expect(response.body).to.not.have.property('buildId');
            });
            it('should succeed to apply algorithm with version inc', async () => {
                const body = {
                    name: `my-alg-${uuid()}`,
                    mem: "50Mi",
                    cpu: 1,
                    env: 'nodejs'
                }
                const payload = JSON.stringify(body);
                const formData1 = {
                    payload,
                    file: fse.createReadStream('tests/mocks/algorithm.tar.gz')
                };
                const formData2 = {
                    payload,
                    file: fse.createReadStream('tests/mocks/algorithm.zip')
                };
                const uri = restPath + '/apply';
                const options1 = { uri, formData: formData1 };
                const options2 = { uri, formData: formData2 };
                const getRequest = { uri: restPath + '/' + body.name, method: 'GET' };

                await request(options1)
                const res1 = await request(getRequest);
                await request(options2);
                const res2 = await request(getRequest);
                expect(res1.body.version).to.equal('1.0.0');
                expect(res2.body.version).to.equal('1.0.1');
            });
        })
        describe('Gitlab', () => {
            it('Gitlab-should create build with last commit data', async () => {
                const url = 'https://gitlab.com/maty21/anomaly.git';
                const name = uuid();
                const body = {
                    name,
                    gitRepository: {
                        url,
                        //token: '1111',
                        gitKind: "gitlab"
                    },
                    env: 'nodejs',
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const res = await request(options);
                expect(res.body).to.have.property('buildId');
            });
        });
        describe('Image', () => {
            it('should not take affect on algorithmImage change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    algorithmImage: 'new-test-algorithmImage'
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...defaultProps, ...apply1 });
            });
            it('should take affect on algorithmImage change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    algorithmImage: 'new-test-algorithmImage'
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { options: JSON.stringify({ overrideImage: true }), payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just cpu change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    cpu: 2
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just gpu change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    gpu: 2
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just mem change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    mem: "1.5Gi"
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just minHotWorkers change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    minHotWorkers: 3
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });
            it('should succeed to apply algorithm with just algorithmEnv change', async () => {
                const apply1 = {
                    name: `my-alg-${uuid()}`,
                    algorithmImage: 'test-algorithmImage',
                    mem: "50Mi",
                    type: "Image",
                    cpu: 1,
                    minHotWorkers: 5,
                    options: {
                        debug: false,
                        pending: false
                    },
                    algorithmEnv: {
                        storage: 's3'
                    }
                }
                const apply2 = {
                    name: apply1.name,
                    algorithmEnv: {
                        storage: 'fs'
                    }
                }
                const uri = restPath + '/apply';
                const request1 = { uri, formData: { payload: JSON.stringify(apply1) } };
                const request2 = { uri, formData: { payload: JSON.stringify(apply2) } };

                // apply algorithm
                await request(request1)

                // apply algorithm again
                await request(request2);

                const request3 = {
                    uri: restPath + '/' + apply1.name,
                    method: 'GET'
                };
                const response3 = await request(request3);
                expect(response3.body).to.eql({ ...defaultProps, ...apply1, ...apply2 });
            });
        });
    });
    describe('/store/algorithms PUT', () => {
        it('should throw validation error of memory min 4 Mi', async () => {
            const body = Object.assign({}, algorithms[0]);
            body.mem = '3900Ki';
            const options = {
                method: 'PUT',
                uri: restPath,
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('memory must be at least 4 Mi');
        });
        it('should succeed to update algorithm', async () => {
            const body = { ...algorithms[0] };
            const options = {
                uri: restPath,
                method: 'PUT',
                body
            };
            const response = await request(options);
            expect(response.body).to.eql({ ...defaultProps, ...body });
        });
        it('should failed to update algorithm', async () => {
            const body = { ...algorithms[0], algorithmImage: '' };
            const options = {
                uri: restPath,
                method: 'PUT',
                body
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body.error.message).to.equal('cannot apply algorithm due to missing image url or build data');
        });
        it('should succeed to update algorithm', async () => {
            const body = { ...algorithms[0], algorithmImage: 'new-image' };
            const options = {
                uri: restPath,
                method: 'PUT',
                body
            };
            const response = await request(options);
            expect(response.body).to.eql({ ...defaultProps, ...body });
        });
    });
});
