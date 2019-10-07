const { expect } = require('chai');
const fse = require('fs-extra');
const uuidv4 = require('uuid/v4');
const HttpStatus = require('http-status-codes');
const converter = require('@hkube/units-converter');
const { MESSAGES } = require('../lib/consts/builds');
const githubSample = require('./mocks/github-sample.json')
const { algorithms } = require('./mocks');
const { request } = require('./utils');
let restUrl, restPath, applyPath;

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
            const mem = converter.getMemoryInMi(body.mem);
            expect(response.body.mem).to.equal(mem);
            expect(response.body.memReadable).to.equal(body.mem);
        });
    });
    describe('/store/algorithms:name DELETE', () => {
        it('should throw error algorithm not found', async () => {
            const options = {
                uri: restPath + '/not_exists',
                method: 'DELETE',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('error');
            expect(response.body.error.code).to.equal(HttpStatus.NOT_FOUND);
            expect(response.body.error.message).to.equal('algorithm not_exists Not Found');
        });
        it('should delete specific algorithm', async () => {
            const optionsInsert = {
                uri: restPath,
                body: {
                    name: "delete",
                    algorithmImage: "image"
                }
            };
            await request(optionsInsert);

            const options = {
                uri: restPath + '/delete',
                method: 'DELETE',
                body: {}
            };
            const response = await request(options);
            expect(response.body).to.have.property('message');
            expect(response.body.message).to.equal('OK');
        });
    });
    describe('/store/algorithms GET', () => {
        it('should throw validation error of required property jobId', async () => {
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
                name: uuidv4(),
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
                expect(response.body.error.message).to.equal('algorithm name must contain only lower-case alphanumeric, dash or dot');
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
                expect(response.body.error.message).to.equal('algorithm name must contain only lower-case alphanumeric, dash or dot');
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
                expect(response.body.error.message).to.equal('algorithm name must contain only lower-case alphanumeric, dash or dot');
            });
        });
        it('should succeed to store algorithm name (www.example.com)', async () => {
            const body = {
                name: '2-www.exam-ple.com' + uuidv4(),
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
            body.memReadable = body.mem;
            body.mem = converter.getMemoryInMi(body.mem);
            expect(response.body).to.deep.equal({
                ...body,
                minHotWorkers: 0,
                options: {
                    debug: false,
                    pending: false
                },
                type: "Image"
            });
        });
        it('should succeed to store algorithm', async () => {
            const body = {
                name: uuidv4(),
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
            body.memReadable = body.mem;
            body.mem = converter.getMemoryInMi(body.mem);
            expect(response.body).to.deep.equal({
                ...body,
                minHotWorkers: 0,
                options: {
                    debug: false,
                    pending: false
                }
            });
        });
    });
    describe('/store/algorithms/apply POST', () => {
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
                name: uuidv4(),
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
                name: uuidv4(),
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
                name: `my-alg-${uuidv4()}`,
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
                name: `my-alg-${uuidv4()}`,
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
                name: `my-alg-${uuidv4()}`,
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
        it('should succeed to apply algorithm with first build', async () => {
            const payload = {
                name: `my-alg-${uuidv4()}`,
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
                name: `my-alg-${uuidv4()}`,
                mem: "50Mi",
                cpu: 1
            }
            const body1 = {
                ...body,
                version: '1.8.0',
                env: 'nodejs'
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
                name: `my-alg-${uuidv4()}`,
                mem: "50Mi",
                cpu: 1
            }
            const body1 = {
                ...body,
                version: '1.8.0',
                env: 'nodejs'
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
                name: `my-alg-${uuidv4()}`,
                mem: "50Mi",
                cpu: 1,
                version: '1.8.0',
                env: 'nodejs'
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
            expect(response.response.statusCode).to.equal(HttpStatus.BAD_REQUEST);
            expect(response.body).to.not.have.property('buildId');
            expect(response.body.error.message).to.equal(MESSAGES.APPLY_ERROR);
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
            const body = { ...algorithms[0], type: "Image" };
            const options = {
                uri: restPath,
                method: 'PUT',
                body
            };
            const response = await request(options);
            body.memReadable = body.mem;
            body.mem = converter.getMemoryInMi(body.mem);
            expect(response.body).to.deep.equal(body);
        });
    });
    describe('Git', () => {
        let webhookPath = null;
        let applyPath = null;
        before(() => {
            webhookPath = `${restUrl}/builds/webhook/github`;
            applyPath = `${restUrl}/store/algorithms/apply`;
        });
        describe('Github', () => {
            it('should run simple push webhook', async () => {
                const options = {
                    uri: webhookPath,
                    body: { payload: JSON.stringify(githubSample) },
                    method: 'POST'

                };
                const res = await request(options);
                const filterdRes = res.body.find(r => r.buildId.includes('green-alg'))
                expect(filterdRes).to.not.be.null
            })
            it('should create build with last commit data', async () => {

                const name = uuidv4();
                const body = {
                    name,
                    mem: "6000Mi",
                    cpu: 1,
                    gitRepository: {
                        url: "https://github.com/maty21/statistisc",
                        branchName: "master",
                        gitKind: "github"
                    },
                    env: "nodejs",
                    type: "Git"
                }
                const payload = JSON.stringify(body);
                const options = {
                    uri: applyPath,
                    body: { payload }
                };
                const _res = await request(options);
                expect(_res.body.buildId).to.contain(name)

            });
        })
    })
});
