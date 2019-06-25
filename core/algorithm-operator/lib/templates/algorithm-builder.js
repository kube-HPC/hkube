const { ALGORITHM_BUILDS, KANIKO } = require('../../lib/consts/containers');

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
                                name: 'DOCKER_PULL_USERNAME',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'pull-username'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PULL_PASSWORD',
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
                                name: 'DOCKER_PUSH_USERNAME',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'push-username'
                                    }
                                }
                            },
                            {
                                name: 'DOCKER_PUSH_PASSWORD',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'docker-credentials-secret',
                                        key: 'push-password'
                                    }
                                }
                            }
                        ]
                    }
                ],
                restartPolicy: 'Never'
            }
        },
        backoffLimit: 4
    }
};

const dockerVolumes = {
    volumeMounts: [
        {
            name: 'dockersock',
            mountPath: '/var/run/docker.sock'
        }
    ],
    volumes: [
        {
            name: 'dockersock',
            hostPath: {
                path: '/var/run/docker.sock'
            }
        }
    ]
};

const kanikoVolumes = {
    volumeMounts: [
        {
            name: 'commands',
            mountPath: '/tmp/commands'
        },
        {
            name: 'workspace',
            mountPath: '/tmp/workspace'
        }
    ],
    volumes: [
        {
            name: 'commands',
            emptyDir: {}
        },
        {
            name: 'workspace',
            emptyDir: {}
        }
    ]
};

const kanikoContainer = {
    name: KANIKO,
    image: `hkube/${KANIKO}`,
    volumeMounts: [
        {
            name: 'commands',
            mountPath: '/commands'
        },
        {
            name: 'workspace',
            mountPath: '/workspace'
        }
    ],
};

module.exports = {
    jobTemplate,
    kanikoContainer,
    dockerVolumes,
    kanikoVolumes
};
