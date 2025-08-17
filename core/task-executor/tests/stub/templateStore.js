const { stateType } = require('@hkube/consts');

const templateStore = [
    {
        name: 'eval-alg',
        algorithmImage: 'hkube/algorunner',
        cpu: 0.5,
        mem: '256Mi'
    },
    {
        name: 'green-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 7,
        mem: '512Mi'
    },
    {
        name: 'yellow-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi'
    },
    {
        name: 'black-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi'
    },
    {
        name: 'max-cpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 25,
        mem: '128Mi'
    },
    {
        name: 'max-mem',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '50Gi'
    },
    {
        name: 'max-gpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        gpu: 10
    },
    {
        name: 'big-cpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 8,
        mem: '128Mi'
    },
    {
        name: 'big-mem',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '37Gi'
    },
    {
        name: 'big-gpu',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        gpu: 6
    },
    {
        name: 'node-selector',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        nodeSelector: {
            type: 'cpu-extreme'
        }
    },
    {
        name: 'node-all-params',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 100,
        mem: '50Gi',
        gpu: 100,
        nodeSelector: {
            type: 'gpu-extreme',
            max: 'bound'
        }
    },
    {
        name: 'selector-multi-values',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        gpu: 0,
        nodeSelector: {
            "kubernetes.io/hostname": ["node1", "node2", "node3"]
        }
    },
    {
        name: 'selector-multi-values-node4',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 1,
        mem: '128Mi',
        gpu: 0,
        nodeSelector: {
            "kubernetes.io/hostname": ["node1", "node2", "node4"]
        }
    },
    {
        name: 'worker-custom-resources-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            limits: {
                cpu: 0.2,
                memory: "512Mi"
            },
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        }
    },
    {
        name: 'worker-custom-resources-nolimit-alg',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        }
    },
    {
        name: 'algo-pvc-non-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        volumes: [
            {
                name: 'v1',
                persistentVolumeClaim: {
                    claimName: 'hjkjhgfdfjkjhgffg'
                }
            }
        ]
    },
    {
        name: 'algo-pvc-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        volumes: [
            {
                name: 'v1',
                persistentVolumeClaim: {
                    claimName: 'pvc-1'
                }
            }
        ]
    },
    {
        name: 'algo-car-pvc-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        volumes: [
            {
                name: 'v1',
                persistentVolumeClaim: {
                    claimName: 'pvc-1'
                }
            }
        ],
        sideCars: [
            {
                container: {
                    name: 'mycar',
                    image: 'hkube/api-server:v2.8.19-sidecar_feature-11879765908'
                }
            }
        ]
    },
    {
        name: 'algo-config-map-non-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        volumes: [
            {
                name: 'v1',
                configMap: {
                    name: 'hjkjhgfdfjkjhgffg'
                }
            }
        ]
    },
    {
        name: 'algo-config-map-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        volumes: [
            {
                name: 'v1',
                configMap: {
                    name: 'config-map-1'
                }
            }
        ]
    },
    {
        name: 'algo-car-config-map-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        volumes: [
            {
                name: 'v1',
                configMap: {
                    name: 'config-map-1'
                }
            }
        ],
        sideCars: [
            {
                container: {
                    name: 'mycar',
                    image: 'hkube/api-server:v2.8.19-sidecar_feature-11879765908'
                }
            }
        ]
    },
    {
        name: 'algo-secret-non-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        volumes: [
            {
                name: 'v1',
                secret: {
                    secretName: 'hjkjhgfdfjkjhgffg'
                }
            }
        ]
    },
    {
        name: 'algo-secret-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        volumes: [
            {
                name: "v1",
                secret: {
                    secretName: "secret-1"
                }
            }
        ]
    },
    {
        name: 'algo-car-secret-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        volumes: [
            {
                name: "v1",
                secret: {
                    secretName: "secret-1"
                }
            }
        ],
        sideCars: [
            {
                container: {
                    name: "mycar",
                    image: "docker.io/hkubedevtest/print-every-10-sec:v4o4c4xne"
                },
                volumeMounts: [
                    {
                        name: "v1",
                        mountPath: "/tmp/foo"
                    }
                ],
                environments: [
                    {
                        name: "env1",
                        value: "val1"
                    }
                ]
            }
        ]
    },
    {
        name: 'algo-car-emptyDir',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        volumes: [
            {
                name: "v1",
                emptyDir: {}
            }
        ],
        sideCars: [
            {
                container: {
                    name: "mycar",
                    image: "docker.io/hkubedevtest/print-every-10-sec:v4o4c4xne"
                },
                volumeMounts: [
                    {
                        name: "v1",
                        mountPath: "/tmp/foo"
                    }
                ],
                environments: [
                    {
                        name: "env1",
                        value: "val1"
                    }
                ]
            }
        ]
    },
    {
        name: 'algo-car-container-req',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        sideCars: [
            {
                container: {
                    name: "mycar",
                    image: "docker.io/hkubedevtest/print-every-10-sec:v4o4c4xne",
                    resources: {
                        requests: {
                            cpu: 0.2,
                            memory: '150Mi'
                        }
                    }
                }
            }
        ]
    },
    {
        name: 'algo-car-container-lim',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        sideCars: [
            {
                container: {
                    name: "mycar",
                    image: "docker.io/hkubedevtest/print-every-10-sec:v4o4c4xne",
                    resources: {
                        limits: {
                            cpu: 0.2,
                            memory: '250Mi'
                        }
                    }
                }
            }
        ]
    },
    {
        name: 'algo-car-container-req-lim',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        sideCars: [
            {
                container: {
                    name: "mycar",
                    image: "docker.io/hkubedevtest/print-every-10-sec:v4o4c4xne",
                    resources: {
                        requests: {
                            cpu: 0.1,
                            memory: '150Mi'
                        },
                        limits: {
                            cpu: 0.2,
                            memory: '250Mi'
                        }
                    }
                }
            }
        ]
    },
    {
        name: 'algo-car-lim-lower-req',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        sideCars: [
            {
                container: {
                    name: 'mycar',
                    image: 'hkube/api-server:v2.8.19-sidecar_feature-11879765908',
                    resources: {
                        requests: {
                            cpu: 3
                        },
                        limits: {
                            cpu: 1
                        }
                    }
                }
            }
        ]
    },
    {
        name: 'algo-car-volume-mount',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        volumes: [
            {
                name: "v1",
                emptyDir: {}
            }
        ],
        volumeMounts: [
            {
                name: "v1",
                mountPath: "/tmp/foo"
            }
        ],
    },
    {
        name: 'algo-kai-object',
        version: "mlcr853dba123",
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        kaiObject: {
            queue: 'test',
            memory: "3000",
            fraction: 0.5
        }
    },
    {
        name: 'algo-kai-object-no-queue',
        version: "mlcr853dba456",
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        kaiObject: {
            memory: "3000",
            fraction: 0.5
        }
    },
    {
        name: 'algo-kai-object-empty',
        version: "mlcr853dba789",
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        kaiObject: {}
    },
    {
        name: 'algo-kai-object-queue-not-exist',
        version: "mlcr853dba0",
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        kaiObject: {
            queue: 'non-exist-queue',
            memory: "3000",
            fraction: 0.5
        }
    },
    {
        name: 'algo-state-type-' + stateType.Stateful,
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.001,
        mem: '128Mi',
        stateType: stateType.Stateful
    },
    {
        name: 'algo-state-type-' + stateType.Stateless,
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.001,
        mem: '128Mi',
        stateType: stateType.Stateless
    },
    {
        name: 'algo-state-type-undefined',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.001,
        mem: '128Mi',
        stateType: undefined
    },
    {
        name: 'print-every-10-sec',
        algorithmImage: 'docker.io/hkubedevtest/print-every-10-sec:vokska3od',
        cpu: 2.8,
        mem: '256Mi'
    }
];

module.exports = templateStore;
