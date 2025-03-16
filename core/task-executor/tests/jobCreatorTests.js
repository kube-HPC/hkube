const clonedeep = require('lodash.clonedeep');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const { main, logger } = configIt.load();
const log = new Logger(main.serviceName, logger);
const options = main;
const { expect } = require('chai');
const { applyAlgorithmImage, applyAlgorithmName, applyWorkerImage, createJobSpec, applyHotWorker } = require('../lib/jobs/jobCreator'); // eslint-disable-line object-curly-newline
const { jobTemplate } = require('./stub/jobTemplates');
const templateStore = require('./stub/templateStore');
const { settings: globalSettings } = require('../lib/helpers/settings');
const { setWorkerImage } = require('../lib/reconcile/createOptions');
const parse = require('@hkube/units-converter');

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
            expect(res).to.eql('foo/wkr:v1.2.3');
        });

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
            expect(res).to.eql('hkube/worker:v1.2.3');
        });

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
        });
    });

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

    describe('apply labels', () => {
        it('should add new label', () => {
            const labels = {
                'key': 'my-value'
            }
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options, labels });
            expect(res).to.nested.include({ 'spec.template.metadata.labels.key': labels.key });
        });

        it('should not override label', () => {
            const labels = {
                'group': 'my-group'
            }
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options, labels });
            expect(res.spec.template.metadata.labels.group).to.not.eql(labels.group);
        });
    });

    describe('apply annotations', () => {
        it('should add new annotation', () => {
            const annotations = {
                'key': 'my-value'
            }
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options, annotations });
            expect(res).to.nested.include({ 'spec.template.metadata.annotations.key': annotations.key });
        });

        it('should override annotation', () => {
            const annotations1 = {
                'group': 'my-group'
            }
            const annotations2 = {
                'group': 'new-group'
            }
            const res1 = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options, annotations: annotations1 });
            const res2 = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options, annotations: annotations2 });
            expect(res1.spec.template.metadata.annotations.group).to.eql(annotations1.group);
            expect(res2.spec.template.metadata.annotations.group).to.eql(annotations2.group);
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
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options, clusterOptions: { datasourcesServiceEnabled: true } });
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
                name: 'STORAGE_ENCODING',
                valueFrom: {
                    configMapKeyRef: {
                        key: 'STORAGE_ENCODING',
                        name: 'task-executor-configmap'
                    }
                }
            });
            expect(res.metadata.name).to.include('myalgo1-');
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'datasources-storage',
                    persistentVolumeClaim: { claimName: 'hkube-datasources' }
                }
            );
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'datasources-storage',
                    mountPath: '/hkube/datasources-storage'
                }
            );
        });

        it('should apply with worker', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options });
            expect(res).to.nested.include({ 'spec.template.spec.containers[0].image': 'workerImage2' });
            expect(res).to.nested.include({ 'spec.template.spec.containers[1].image': 'myImage1' });
            expect(res).to.nested.include({ 'metadata.labels.algorithm-name': 'myalgo1' });
            expect(res.metadata.name).to.include('myalgo1-');
        });

        it('should apply imagePullSecrets', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, clusterOptions: { imagePullSecretName: 'my-secret' } });
            expect(res.spec.template.spec.imagePullSecrets).to.exist;
            expect(res.spec.template.spec.imagePullSecrets[0]).to.eql({ name: 'my-secret' });
        });

        it('should apply gateway params to env', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', kind: 'gateway', options });
            const env = res.spec.template.spec.containers[1].env;
            expect(env).to.deep.include({
                name: 'NODE_ENV',
                value: 'production'
            });
            expect(env).to.deep.include({
                name: 'BASE_URL_PATH',
                valueFrom: {
                    configMapKeyRef: {
                        key: 'BASE_URL_PATH',
                        name: 'algorithm-gateway-configmap'
                    }
                }
            });
            expect(env).to.deep.include({
                name: 'INGRESS_PREFIX',
                valueFrom: {
                    configMapKeyRef: {
                        key: 'INGRESS_PREFIX',
                        name: 'algorithm-gateway-configmap'
                    }
                }
            });
            expect(env).to.deep.include({
                name: 'REST_PORT',
                valueFrom: {
                    configMapKeyRef: {
                        key: 'REST_PORT',
                        name: 'algorithm-gateway-configmap'
                    }
                }
            });
        });

        it('should apply cache params to env', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', reservedMemory: '502.552M', options });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'DISCOVERY_MAX_CACHE_SIZE', value: '479' })
        });

        it('should apply cache params to env', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', reservedMemory: '256Mi', options });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'DISCOVERY_MAX_CACHE_SIZE', value: '256' })
        });

        it('should not apply cache params to env if empty', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', reservedMemory: '256Mi', options });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'DISCOVERY_MAX_CACHE_SIZE', value: '256' })
        });

        it('should not apply cache params to env if no cache', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', options });
            expect(res.spec.template.spec.containers[1].env).to.not.deep.include({ name: 'DISCOVERY_MAX_CACHE_SIZE', value: '256' })
            expect(res.spec.template.spec.containers[1].env).to.not.deep.include({ name: 'STORAGE_MAX_CACHE_SIZE', value: '128' })
        });

        it('should apply java memory convert Mi', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', reservedMemory: '256Mi', env: 'java', options, resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200Mi' } } });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'JAVA_DERIVED_MEMORY', value: '160' })
        });

        it('should apply java memory G', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', reservedMemory: '256G', env: 'java', options, resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200G' } } });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'JAVA_DERIVED_MEMORY', value: '152588' })
        });

        it('should not apply java memory for non java env', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', reservedMemory: '256G', env: 'python', options, resourceRequests: { requests: { cpu: '200m' }, limits: { cpu: '500m', memory: '200Gi' } } });
            expect(res.spec.template.spec.containers[1].env).to.not.deep.include({ name: 'JAVA_DERIVED_MEMORY', value: '160G' })
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
                },
                {
                    pvcName: 'fromcm',
                    path: '/tmp/cm',
                    volumeType: 'configMap'
                },
                {
                    pvcName: 'empty',
                    path: '/tmp/empty',
                    volumeType: 'emptyDir'
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
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'fromcm-2',
                    configMap: { name: mounts[2].pvcName }
                }
            );
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'empty-3',
                    emptyDir: {}
                }
            );
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'mypvc2-1',
                    mountPath: mounts[1].path
                }
            );
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'fromcm-2',
                    mountPath: mounts[2].path
                }
            );
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'empty-3',
                    mountPath: mounts[3].path
                }
            );
        });

        it('should apply 0 mounts', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, mounts: [], clusterOptions: { datasourcesServiceEnabled: true } });
            expect(res.spec.template.spec.volumes).to.have.length(4)
        });

        it('should apply no mounts', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, clusterOptions: { datasourcesServiceEnabled: true } });
            expect(res.spec.template.spec.volumes).to.have.length(4)
        });

        it('should not apply datasources pvc if disabled', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1', workerImage: 'workerImage2', options, clusterOptions: { datasourcesServiceEnabled: false } });
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

        it('should apply nodeSelector', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1',nodeSelector: {name: "node1"} , options });
            expect(res.spec.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].values).to.eql(['node1']);
        });

        it('should apply nodeSelector multiple values in same type', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1',nodeSelector: {name: ["node1","node2"]} , options });
            expect(res.spec.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions[0].values).to.eql(['node1','node2']);
        });

        it('should apply nodeSelector multiple values in multiple types', () => {
            const res = createJobSpec({ algorithmImage: 'myImage1', algorithmName: 'myalgo1',nodeSelector: {name: ["node1","node2"], gpu: "max-gpu", "kubernetes.io/arch": ["amd64","intel"]} , options });
            expect(res.spec.template.spec.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms[0].matchExpressions.length).to.eql(3);
        });
    });

    describe('sidecars', () => {
        describe('system sidecars', () => {
            const formatEnvironments = (environments) => {
                return Object.entries(environments).map(([key, value]) => ({
                    name: key,
                    value: value,
                }));
            }

            const sideCar1Name ='my-sidecar-1';
            const sideCar2Name ='my-sidecar-2';

            before(() => {
                globalSettings.sidecars = [{
                    name: sideCar1Name,
                    container: {
                        name: sideCar1Name,
                        image: 'foo/bar'
                    },
                    volumes: [
                        {
                            name: "v1",
                            emptyDir: {}
                        },
                        {
                            name: "v2",
                            configMap: {
                                name: "cm2"
                            }
                        }
                    ],
                    volumeMounts: [
                        {
                            name: "v2",
                            mountPath: '/tmp/foo'
                        }
    
                    ],
                    environments: {
                        "env1": "val1",
                        "env2": "val2"
                    }
                },
                {
                    name: sideCar2Name,
                    container: { 
                        name: sideCar2Name,
                        image: 'foo/bar' 
                    },
                    volumes: [
                        {
                            name: "v1",
                            emptyDir: {}
                        },
                        {
                            name: "v2",
                            configMap: {
                                name: "cm2"
                            }
                        }
                    ],
                    volumeMounts: [
                        {
                            name: "v2",
                            mountPath: '/tmp/foo'
                        }
    
                    ],
                    environments: {
                        "env1": "val1",
                        "env2": "val2"
                    }
                }
            ]
            });
    
            after(() => {
                globalSettings.sidecars = [];
            });

            it('should not apply sidecar if not enabled', () => {
                const res = createJobSpec({
                    algorithmImage: 'myImage1',
                    algorithmName: 'myalgo1',
                    options,
                });
                expect(res.spec.template.spec.containers).to.have.lengthOf(2);
            });

            it('should apply sidecar if enabled', () => {
                const res = createJobSpec({
                    algorithmImage: 'myImage1',
                    algorithmName: 'myalgo1',
                    options,
                    clusterOptions: { [`${sideCar1Name}SidecarEnabled`]: true, [`${sideCar2Name}SidecarEnabled`]: true }
                });
                const { containers, volumes } = res.spec.template.spec;
                expect(containers).to.have.lengthOf(4);
                expect(containers[2].name).to.eql(sideCar1Name);
                expect(containers[3].name).to.eql(sideCar2Name);
                expect(volumes).to.deep.include(globalSettings.sidecars[0].volumes[0]);
                expect(volumes).to.deep.include(globalSettings.sidecars[0].volumes[1]);
                expect(volumes).to.deep.include(globalSettings.sidecars[1].volumes[0]);
                expect(volumes).to.deep.include(globalSettings.sidecars[1].volumes[1]);
                expect(containers[2].volumeMounts).to.deep.include(globalSettings.sidecars[0].volumeMounts[0]);
                expect(containers[1].volumeMounts).to.not.deep.include(globalSettings.sidecars[0].volumeMounts[0]);
                expect(containers[2].volumeMounts).to.deep.include(globalSettings.sidecars[1].volumeMounts[0]);
                expect(containers[1].volumeMounts).to.not.deep.include(globalSettings.sidecars[1].volumeMounts[0]);
                expect(containers[2].env).to.deep.include.members(formatEnvironments(globalSettings.sidecars[0].environments));
                expect(containers[3].env).to.deep.include.members(formatEnvironments(globalSettings.sidecars[1].environments));
            });

            it('should not apply sidecar if no sidecar configmap', () => {
                const res = createJobSpec({
                    algorithmImage: 'myImage1',
                    algorithmName: 'myalgo1',
                    options,
                    clusterOptions: { "no-sidecarSidecarEnabled": true }
                });
                expect(res.spec.template.spec.containers).to.have.lengthOf(2);
            });
        });

        describe('custom sidecars', () => {
            before(() => {
                globalSettings.useResourceLimits = true;
            });

            after(() => {
                globalSettings.useResourceLimits = false;
            });

            /**
             * Merges container resource requests and limits, applying default values
             * and adjusting limits if needed.
             *
             * - If `requests` are higher than `limits`, limits will be set to match requests.
             * - If `globalSettings.useResourceLimits` is `false`, limits will be doubled.
             *
             * @param {Object} containerResources - The container resources object.
             * @param {Object} [containerResources.requests] - Requested CPU and memory.
             * @param {string} [containerResources.requests.cpu] - Requested CPU (e.g., "250m").
             * @param {string} [containerResources.requests.mem] - Requested memory (e.g., "512Mi").
             * @param {Object} [containerResources.limits] - Resource limits for CPU and memory.
             * @param {string} [containerResources.limits.cpu] - CPU limit (e.g., "500m").
             * @param {string} [containerResources.limits.mem] - Memory limit (e.g., "1Gi").
             * @returns {Object} Merged resource requests and limits.
             */
            const mergeWithDefaultResources = (containerResources) => {
                const { cpu: reqCPU = main.resources.sideCar.cpu, memory: reqMem = main.resources.sideCar.memory } = containerResources.requests || {}, 
                      reqMEM = parse.getMemoryInMi(reqMem);
            
                const { cpu: limitCPU = main.resources.sideCar.cpu, memory: limitMem = main.resources.sideCar.memory } = containerResources.limits || {}, 
                      limitMEM = parse.getMemoryInMi(limitMem);
            
                return {
                    requests: {
                        cpu: reqCPU,
                        memory: reqMEM + "Mi",
                    },
                    limits: {
                        cpu: (limitCPU < reqCPU) ? reqCPU : (globalSettings.useResourceLimits ? limitCPU : limitCPU * 2),
                        memory: (limitMEM < reqMEM) ? reqMEM + "Mi" : (limitMEM * (globalSettings.useResourceLimits ? 1 : 2)) + "Mi",
                    },
                };
            };

            it('should build spec with sidecar, with default resources', () => {
                const sidecarAlg = templateStore.find(alg => alg.name === 'algo-car-emptyDir');
                sidecarAlg.algorithmName = sidecarAlg.name;
                const sidecar = sidecarAlg.sideCars[0];
                const { container: inputContainer, volumes: inputVolumes, volumeMounts: inputVolumeMounts, environments: inputEnv } = sidecar;
                const defaultResources = mergeWithDefaultResources(inputContainer);

                const res = createJobSpec({ ...sidecarAlg, options });
                const { containers, volumes } = res.spec.template.spec;
                const sidecarContainer = containers.find(c => c.name === inputContainer.name);
                const sidecarVolume = volumes.find(v => v.name === inputVolumes[0].name);

                expect(sidecarContainer).to.exist;
                expect(containers).to.have.lengthOf(3); // worker, algorunner and sidecar
                expect(sidecarContainer.name).to.equal(inputContainer.name);
                expect(sidecarContainer.image).to.equal(inputContainer.image);
                expect(sidecarContainer.env[0].valueFrom).to.deep.equal(inputEnv[0]);
                expect(sidecarContainer.volumeMounts).to.deep.equal(inputVolumeMounts);
                expect(sidecarContainer.resources).to.deep.equal(defaultResources);
                
                expect(sidecarVolume).to.exist;
                expect(sidecarVolume).to.deep.equal(inputVolumes[0]);
            });

            it('should build spec with sidecar, with default limits and given requests', () => {
                const sidecarAlg = templateStore.find(alg => alg.name === 'algo-car-container-req');
                sidecarAlg.algorithmName = sidecarAlg.name;
                const sidecar = sidecarAlg.sideCars[0];
                const { container: inputContainer } = sidecar;
                const resources = mergeWithDefaultResources(inputContainer.resources);

                const res = createJobSpec({ ...sidecarAlg, options });
                const { containers } = res.spec.template.spec;
                const sidecarContainer = containers.find(c => c.name === inputContainer.name);

                expect(sidecarContainer.resources).to.deep.equal(resources);
            });

            it('should build spec with sidecar, with default requests and given limits', () => {
                const sidecarAlg = templateStore.find(alg => alg.name === 'algo-car-container-lim');
                sidecarAlg.algorithmName = sidecarAlg.name;
                const sidecar = sidecarAlg.sideCars[0];
                const { container: inputContainer } = sidecar;
                const resources = mergeWithDefaultResources(inputContainer.resources);

                const res = createJobSpec({ ...sidecarAlg, options });
                const { containers } = res.spec.template.spec;
                const sidecarContainer = containers.find(c => c.name === inputContainer.name);

                expect(sidecarContainer.resources).to.deep.equal(resources);
            });

            it('should build spec with sidecar, with given requests and limits', () => {
                const sidecarAlg = templateStore.find(alg => alg.name === 'algo-car-container-req-lim');
                sidecarAlg.algorithmName = sidecarAlg.name;
                const sidecar = sidecarAlg.sideCars[0];
                const { container: inputContainer } = sidecar;
                const resources = mergeWithDefaultResources(inputContainer.resources);

                const res = createJobSpec({ ...sidecarAlg, options });
                const { containers } = res.spec.template.spec;
                const sidecarContainer = containers.find(c => c.name === inputContainer.name);

                expect(sidecarContainer.resources).to.deep.equal(resources);
            });

            it('should build spec with sidecar, with given requests and limits, and missing field', () => {
                const sidecarAlg = templateStore.find(alg => alg.name === 'algo-car-container-req-lim');
                sidecarAlg.algorithmName = sidecarAlg.name;
                const sidecar = sidecarAlg.sideCars[0];
                const { container: inputContainer } = sidecar;

                const scenarios = [
                    { description: 'missing requests.cpu', field: 'requests', type: 'cpu' },
                    { description: 'missing requests.memory', field: 'requests', type: 'memory' },
                    { description: 'missing limits.cpu', field: 'limits', type: 'cpu' },
                    { description: 'missing limits.memory', field: 'limits', type: 'memory' }
                ];

                scenarios.forEach(({ description, field, type }) => {
                    const inputContainerClone = { ...inputContainer };
                    delete inputContainerClone.resources[field][type];

                    const resources = mergeWithDefaultResources(inputContainerClone.resources);
                    const res = createJobSpec({ ...sidecarAlg, options });
                    const { containers } = res.spec.template.spec;
                    const sidecarContainer = containers.find(c => c.name === inputContainer.name);

                    expect(sidecarContainer.resources).to.deep.equal(resources, `Failed on scenario: ${description}`);
                });
            });
        });
    });

    describe('devMode', () => {
        it('should apply with devMode', () => {
            const res = createJobSpec({
                algorithmImage: 'myImage1',
                algorithmName: 'myalgo1',
                options,
                algorithmOptions: { devMode: true },
                clusterOptions: { devModeEnabled: true }
            });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'DEV_MODE', value: 'true' });
            expect(res.spec.template.spec.containers[0].env).to.deep.include({ name: 'DEV_MODE', value: 'true' });
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'hkube-dev-sources',
                    mountPath: '/hkube/algorithm-runner/algorithm_unique_folder',
                    subPath: 'algorithms/myalgo1'
                }
            );
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'hkube-dev-sources',
                    persistentVolumeClaim: { claimName: 'hkube-dev-sources-pvc' }
                }
            );
        });

        it('should apply with custom mount path when "devMode" and "devFolder" are present', () => {
            const res = createJobSpec({
                algorithmImage: 'myImage1',
                algorithmName: 'myalgo1',
                options,
                algorithmOptions: { devMode: true, devFolder: '/myFolder/mySecondFolder' },
                clusterOptions: { devModeEnabled: true }
            });
            expect(res.spec.template.spec.containers[1].env).to.deep.include({ name: 'DEV_MODE', value: 'true' });
            expect(res.spec.template.spec.containers[1].volumeMounts).to.deep.include(
                {
                    name: 'hkube-dev-sources',
                    mountPath: '/myFolder/mySecondFolder',
                    subPath: 'algorithms/myalgo1'
                }
            );
            expect(res.spec.template.spec.volumes).to.deep.include(
                {
                    name: 'hkube-dev-sources',
                    persistentVolumeClaim: { claimName: 'hkube-dev-sources-pvc' }
                }
            );
        });

        it('should not add devMode if cluster disabled', () => {
            const res = createJobSpec({
                algorithmImage: 'myImage1',
                algorithmName: 'myalgo1',
                options,
                algorithmOptions: { devMode: true },
                clusterOptions: { devModeEnabled: false }
            });
            expect(res.spec.template.spec.containers[1].env).to.not.deep.include({ name: 'DEV_MODE', value: 'true' });
        });

        it('should not add devMode if algorithm disabled', () => {
            const res = createJobSpec({
                algorithmImage: 'myImage1',
                algorithmName: 'myalgo1',
                options,
                algorithmOptions: { devMode: false },
                clusterOptions: { devModeEnabled: true }
            });
            expect(res.spec.template.spec.containers[1].env).to.not.deep.include({ name: 'DEV_MODE', value: 'true' });
        });
    });
});
