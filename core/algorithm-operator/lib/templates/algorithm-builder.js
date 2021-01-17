const { ALGORITHM_BUILDS, KANIKO, OC_BUILDER } = require('../consts/containers');

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
                serviceAccountName: 'algorithm-builder-serviceaccount',
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
                                name: 'NAMESPACE',
                                valueFrom: {
                                    fieldRef: {
                                        fieldPath: 'metadata.namespace'
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
                                name: 'NODE_WRAPPER_VERSION',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'NODE_WRAPPER_VERSION'
                                    }
                                }
                            },
                            {
                                name: 'PYTHON_WRAPPER_VERSION',
                                valueFrom: {
                                    configMapKeyRef: {
                                        name: 'algorithm-operator-configmap',
                                        key: 'PYTHON_WRAPPER_VERSION'
                                    }
                                }
                            },
                            {
                                name: 'MONGODB_SERVICE_USER_NAME',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'mongodb-secret',
                                        key: 'mongodb-username'
                                    }
                                }
                            },
                            {
                                name: 'MONGODB_SERVICE_PASSWORD',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'mongodb-secret',
                                        key: 'mongodb-password'
                                    }
                                }
                            },
                            {
                                name: 'MONGODB_DB_NAME',
                                valueFrom: {
                                    secretKeyRef: {
                                        name: 'mongodb-secret',
                                        key: 'mongodb-database'
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
const openshiftVolumes = {
    volumeMounts: [
        {
            name: 'commands',
            mountPath: '/tmp/commands'
        },
        {
            name: 'workspace',
            mountPath: '/tmp/workspace'
        },
        {
            name: 'uploads',
            mountPath: '/hkube/algorithm-builder/uploads'
        },
        {
            name: 'builds',
            mountPath: '/hkube/algorithm-builder/builds'
        },
        {
            name: 'kube',
            mountPath: '/.kube'
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
        },
        {
            name: 'config',
            emptyDir: {}
        },
        {
            name: 'uploads',
            emptyDir: {}
        },
        {
            name: 'builds',
            emptyDir: {}
        },
        {
            name: 'kube',
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
const openshiftContainer = {
    name: OC_BUILDER,
    image: `hkube/${OC_BUILDER}`,
    env: [
        {
            name: 'NAMESPACE',
            valueFrom: {
                fieldRef: {
                    fieldPath: 'metadata.namespace'
                }
            }
        }
    ],
    volumeMounts: [
        {
            name: 'commands',
            mountPath: '/commands'
        },
        {
            name: 'workspace',
            mountPath: '/workspace'
        },
        {
            name: 'config',
            mountPath: '/.kube'
        }
    ],
};
module.exports = {
    jobTemplate,
    kanikoContainer,
    openshiftContainer,
    dockerVolumes,
    kanikoVolumes,
    openshiftVolumes
};
