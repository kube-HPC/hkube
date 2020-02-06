const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
const { applyAlgorithmImage, applyAlgorithmName, applyWorkerImage, createJobSpec, applyHotWorker } = require('../lib/jobs/jobCreator'); // eslint-disable-line object-curly-newline
const { jobTemplate } = require('./stub/jobTemplates');
const { settings: globalSettings } = require('../lib/helpers/settings');
const { setWorkerImage } = require('../lib/reconcile/createOptions');

describe('jobCreator', () => {
    describe('applyAlgorithmName', () => {
        it('should replace image name in spec', () => {
            const res = applyAlgorithmName(jobTemplate, 'myAlgo1');
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myAlgo1' });
            expect(res).to.nested.include({ 'spec.template.metadata.labels.algorithm-name': 'myAlgo1' });
        });
        it('should throw if no worker container', () => {
            const missingWorkerSpec = clonedeep(jobTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyAlgorithmName(missingWorkerSpec, 'myAlgo1')).to.throw('unable to find container worker');
        });
    });
    describe('setWorkerImage', () => {
        it('should use image from versions config map', () => {
            const versions = {
                versions: [
                    {
                        project: 'worker',
                        tag: 'v1.2.3',
                        image: 'foo/wkr'
                    }
                ]
            }
            workerTemplate = {
                "name": "worker",
                "image": "hkube/worker",
                "cpu": 0.1,
                "mem": 128
            };
            const res = setWorkerImage(workerTemplate, versions);
            expect(res).to.eql('foo/wkr:v1.2.3')
        })
        it('should use image from template', () => {
            const versions = {
                versions: [
                    {
                        project: 'worker',
                        tag: 'v1.2.3'
                    }
                ]
            }
            workerTemplate = {
                "name": "worker",
                "image": "hkube/worker",
                "cpu": 0.1,
                "mem": 128
            };
            const res = setWorkerImage(workerTemplate, versions);
            expect(res).to.eql('hkube/worker:v1.2.3')
        })
        it('should use image from versions config map with registry', () => {
            const versions = {
                versions: [
                    {
                        project: 'worker',
                        tag: 'v1.2.3',
                        image: 'foo/wkr'
                    }
                ]
            }
            const registry = 'localhost:5555/bar'
            workerTemplate = {
                "name": "worker",
                "image": "hkube/worker",
                "cpu": 0.1,
                "mem": 128
            };
            const res = setWorkerImage(workerTemplate, versions, { registry });
            expect(res).to.eql('localhost:5555/bar/foo/wkr:v1.2.3')
        })
    })
    describe('applyImageName', () => {
        it('should replace algorithm image name in spec', () => {
            const res = applyAlgorithmImage(jobTemplate, 'registry:5000/myAlgo1Image:v2');
            expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'registry:5000/myAlgo1Image:v2' });
        });
        it('should throw if no algorithm container', () => {
            const missingAlgorunnerSpec = clonedeep(jobTemplate);
            missingAlgorunnerSpec.spec.template.spec.containers.splice(1, 1);
            expect(() => applyAlgorithmImage(missingAlgorunnerSpec, 'registry:5000/myAlgo1Image:v2')).to.throw('unable to find container algorunner');
        });
    });
    describe('applyWorkerImageName', () => {
        it('should replace worker image name in spec', () => {
            const res = applyWorkerImage(jobTemplate, 'workerImage:v2');
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage:v2' });
        });
        it('should throw if no worker container2', () => {
            const missingWorkerSpec = clonedeep(jobTemplate);
            missingWorkerSpec.spec.template.spec.containers.splice(0, 1);
            expect(() => applyWorkerImage(missingWorkerSpec, 'workerImage:v2')).to.throw('unable to find container worker');
        });
    });
    describe('applyHotWorker', () => {
        it('should add env to spec', () => {
            const res = applyHotWorker(jobTemplate, false);
            expect(res).to.eql(jobTemplate);
        });
        it('should replace env in spec', () => {
            const res = applyHotWorker(jobTemplate, true);
            expect(res.spec.template.spec.containers[0].env).to.have.lengthOf(6);
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'HOT_WORKER', value: 'true' });
        });
    });
    describe('jobSpec', () => {
        beforeEach(() => {
            globalSettings.applyResources = false;
        });
        it('should throw if no image name', () => {
            expect(() => createJobSpec({ algorithmName: 'myalgo1', options })).to.throw('Unable to create job spec. algorithmImage is required');
        });
        it('should throw if no algorithm name', () => {
            expect(() => createJobSpec({ algorithmImage: 'myImage1', options })).to.throw('Unable to create job spec. algorithmName is required');
        });
        it('should apply all required properties', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options });
            expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'hkube/worker:latest' });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({
                name: 'DEFAULT_STORAGE',
                valueFrom: {
                    configMapKeyRef: {
                        key: 'DEFAULT_STORAGE',
                        name: 'task-executor-configmap'
                    }
                }
            });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({
                name: 'STORAGE_BINARY',
                valueFrom: {
                    configMapKeyRef: {
                        key: 'STORAGE_BINARY',
                        name: 'task-executor-configmap'
                    }
                }
            });
            expect(res.metadata.name).to.include('myalgo1-');
        });
        it('should apply with worker', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage2' });
            expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(res.metadata.name).to.include('myalgo1-');
        });

        it('should apply with binary storage', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, algorithmOptions: { binary: true } });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'WORKER_BINARY', value: 'true' })
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'WORKER_BINARY', value: 'true' })
        });

        it('should apply mounts', () => {
            const mounts = [
                {
                    pvcName: 'mypvc',
                    path: '/mnt/stam'
                },
                {
                    pvcName: 'mypvc2',
                    path: '/tmp/foo'
                }
            ]
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, mounts });
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'mypvc-0',
                    persistentVolumeClaim: { claimName: mounts[0].pvcName }
                }
            );
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'mypvc-0',
                    mountPath: mounts[0].path
                }
            );
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'mypvc2-1',
                    persistentVolumeClaim: { claimName: mounts[1].pvcName }
                }
            );
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'mypvc2-1',
                    mountPath: mounts[1].path
                }
            );

        });
        it('should apply 0 mounts', () => {

            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, mounts: [] });
            expect(res.spec.template.spec.volumes).to.have.length(3)

        });
        it('should apply no mounts', () => {

            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options });
            expect(res.spec.template.spec.volumes).to.have.length(3)
        });
        it('should apply opengl params', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, algorithmOptions: { opengl: true } });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'DISPLAY', value: ':0' })
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'NVIDIA_DRIVER_CAPABILITIES', value: 'all' })
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'xsocket',
                    hostPath: {
                        path: '/tmp/.X11-unix'
                    }
                }
            );
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'xsocket',
                    mountPath: '/tmp/.X11-unix'
                }
            );
        });

        it('should apply without binary storage', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options });
            expect(res.spec.template.spec.containers[0].env).to.deep.not.include({ name: 'WORKER_BINARY', value: 'true' })
            expect(res.spec.template.spec.containers[1].env).to.deep.not.include({ name: 'WORKER_BINARY', value: 'true' })
        });

        it('should apply with worker and resources', () => {
            globalSettings.applyResources = true;

            const res = createJobSpec({
                algorithmImage: 'myImage1',
                algorithmName: 'myalgo1',
                workerImage: 'workerImage2',
                options,
                resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200M' } },
                workerResourceRequests: { requests: { cpu: '100m' }, limits: { cpu: '200m', memory: '100Mi' } }
            });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage2' });
            expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(res.metadata.name).to.include('myalgo1-');
            expect(res.spec.template.spec.containers[1].resources).to.deep.include({ requests: { cpu: '200m' } });
            expect(res.spec.template.spec.containers[1].resources).to.deep.include({ limits: { cpu: '500m', memory: '200M' } });
            expect(res.spec.template.spec.containers[0].resources).to.deep.include({ limits: { cpu: '200m', memory: '100Mi' } });
        });
    });
});
