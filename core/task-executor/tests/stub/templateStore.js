module.exports = [
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
        name: 'algo-car-pvc-non-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        "sideCars": [
            {
                "name": "mycar",
                "container": [
                    {
                        "name": "mycar",
                        "image": "hkube/api-server:v2.8.19-sidecar_feature-11879765908"
                    }
                ],
                "volumes": [
                    {
                        "name": "v1",
                        "persistentVolumeClaim": {
                            "claimName": "hjkjhgfdfjkjhgffg"
                        }
                    }
                ]
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
        "sideCars": [
            {
                "name": "mycar",
                "container": [
                    {
                        "name": "mycar",
                        "image": "hkube/api-server:v2.8.19-sidecar_feature-11879765908"
                    }
                ],
                "volumes": [
                    {
                        "name": "v1",
                        "persistentVolumeClaim": {
                            "claimName": "pvc-1"
                        }
                    }
                ]
            }
        ]
    },
    {
        name: 'algo-car-config-map-non-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        "sideCars": [
            {
                "name": "mycar",
                "container": [
                    {
                        "name": "mycar",
                        "image": "hkube/api-server:v2.8.19-sidecar_feature-11879765908"
                    }
                ],
                "volumes": [
                    {
                        "name": "v1",
                        "configMap": {
                            "name": "hjkjhgfdfjkjhgffg"
                        }
                    }
                ]
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
        "sideCars": [
            {
                "name": "mycar",
                "container": [
                    {
                        "name": "mycar",
                        "image": "hkube/api-server:v2.8.19-sidecar_feature-11879765908"
                    }
                ],
                "volumes": [
                    {
                        "name": "v1",
                        "configMap": {
                            "name": "config-map-1"
                        }
                    }
                ]
            }
        ]
    },
    {
        name: 'algo-car-secret-non-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        "sideCars": [
            {
                "name": "mycar",
                "container": [
                    {
                        "name": "mycar",
                        "image": "hkube/api-server:v2.8.19-sidecar_feature-11879765908"
                    }
                ],
                "volumes": [
                    {
                        "name": "v1",
                        "secret": {
                            "secretName": "hjkjhgfdfjkjhgffg"
                        }
                    }
                ]
            }
        ]
    },
    {
        name: 'algo-car-secret-exist',
        algorithmImage: 'hkube/algorithm-example',
        cpu: 0.5,
        mem: '128Mi',
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        "sideCars": [
            {
                "name": "mycar",
                "container": [
                    {
                        "name": "mycar",
                        "image": "hkube/api-server:v2.8.19-sidecar_feature-11879765908"
                    }
                ],
                "volumes": [
                    {
                        "name": "v1",
                        "secret": {
                            "secretName": "secret-1"
                        }
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
        workerCustomResources: {
            requests: {
                cpu: 0.1,
                memory: "256Mi"
            }
        },
        "sideCars": [
            {
                "name": "mycar",
                "container": [
                    {
                        "name": "mycar",
                        "image": "hkube/api-server:v2.8.19-sidecar_feature-11879765908"
                    }
                ],
                "volumes": [
                    {
                        "name": "v1",
                        "emptyDir": {}
                    }
                ]
            }
        ]
    }
];
