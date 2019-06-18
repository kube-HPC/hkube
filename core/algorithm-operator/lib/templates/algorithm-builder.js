const { ALGORITHM_BUILDS } = require('../../lib/consts/containers');

const jobTemplate = {
    apiVersion: 'batch/v1',
    kind: 'Job',
    metadata: {
        name: ALGORITHM_BUILDS,
        labels: {
            type: ALGORITHM_BUILDS,
            group: 'hkube',
            core: 'true'
        }
    },
    spec: {
        template: {
            metadata: {
                labels: {
                    type: ALGORITHM_BUILDS,
                    group: 'hkube'
                }
            },
            spec: {
                containers: [
                    {
                        name: ALGORITHM_BUILDS,
                        image: `hkube/${ALGORITHM_BUILDS}`,
                        env: [
                            {
                                name: 'NODE_ENV',
                                value: 'production'
                            },
                            {
                                name: 'POD_ID',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.uid'
                                    }
                                }
                            },
                            {
                                name: 'POD_NAME',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.name'
                                    }
                                }
                            },
                            {
                                name: 'DEFAULT_STORAGE',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'DEFAULT_STORAGE'
                                    }
                                }
                            },
                            {
                                name: 'CLUSTER_NAME',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'CLUSTER_NAME'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PULL_REGISTRY',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'pull-registry'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PULL_NAMESPACE',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'pull-namespace'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PULL_USER',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'pull-username'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PULL_PASS',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'pull-password'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PUSH_REGISTRY',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'push-registry'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PUSH_NAMESPACE',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'push-namespace'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PUSH_USER',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'push-username'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PUSH_PASS',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'push-password'
                                    }
                                }
                            }
                        ],
                        volumeMounts: [
                            {
                                name: 'dockersock',
                                mountPath: '/var/run/docker.sock'
                            }
                        ],
                        securityContext: {
                            privileged: true
                        }
                    }
                ],
                volumes: [
                    {
                        name: 'dockersock',
                        hostPath: {
                            path: '/var/run/docker.sock'
                        }
                    }
                ],
                restartPolicy: 'Never'
            }
        },
        backoffLimit: 4
    }
};

module.exports = jobTemplate;
