class MockClient {
    constructor() {
        this.shouldThrow = false;
        // apis.batch.v1.namespaces(this._namespace).jobs.post({ body: spec });
        // apis.batch.v1.namespaces(this._namespace).jobs(jobName).delete();
        const jobs = (jobName) => ({
            delete: () => {
                if (this.shouldThrow) {
                    throw new Error();
                }
                return Promise.resolve({ deleted: jobName })
            },
            get: ({ qs }) => {
                if (this.shouldThrow) {
                    throw new Error();
                }
                return Promise.resolve({ get: { qs } })

            }
        });
        jobs.post = ({ body }) => {
            if (this.shouldThrow) {
                throw new Error();
            }
            return Promise.resolve({ body })
        }
        this.apis = {
            batch: {
                v1: {
                    namespaces: () => ({
                        jobs
                    })
                }
            }
        }

        const pods = (jobName) => ({
            get: ({ qs }={}) => {
                if (this.shouldThrow) {
                    throw new Error();
                }
                return Promise.resolve({ getPod: { qs } })

            },
        });
        pods.get=pods().get
        const configmaps= (name) => ({
            get: () => {
                if (this.shouldThrow) {
                    throw new Error();
                }
                // configMap.body.data['versions.json'
                return Promise.resolve( {
                    body: {
                        data: {
                            'versions.json':JSON.stringify({name})
                        }
                    }
                } )
            }
        })
        const nodes= {
            get: () => {
                if (this.shouldThrow) {
                    throw new Error();
                }
                return Promise.resolve( {
                    get:'nodes'
                } )
            }
        }
        this.api = {
            v1: {
                namespaces: () => ({
                    pods,
                    configmaps
                }),
                pods,
                nodes
            }
        }
    }
}
module.exports = {
    kubernetesClient: () => {
        let callCount = {};
        const registerCount = (name, args) => {
            if (!callCount[name]) {
                callCount[name] = [];
            }
            callCount[name].push(args);
        }
        return {
            mock: {
                config: {
                    fromKubeconfig: () => ({ desc: 'mock config' }),
                    getInCluster: () => ({ desc: 'mock config' }),
                },
                Client: MockClient

            },
            callCount: (name) => { return callCount[name]; },
            clearCount: () => { callCount = {} },
        }
    }
};

