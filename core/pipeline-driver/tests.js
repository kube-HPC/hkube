
const Redis = require('ioredis');
const consumer = require('./lib/consumer/jobs-consumer');
const stateManager = require('./lib/state/state-manager');
const { Producer } = require('producer-consumer.rf');
const validate = require('djsv');
const schema = require('./lib/consumer/schema.js');

class Tests {
    async run(config) {
        const example2 = {
            "name": "string",
            "nodes": [
                {
                    "nodeName": "green-1",
                    "algorithmName": "green-alg",
                    "input": ["#flowInput.files1"]
                },
                {
                    "nodeName": "green-2",
                    "algorithmName": "green-alg-x",
                    "input": ["@green-1", "@green-1.data.result", "flowInput.files1"]
                },
                {
                    "nodeName": "green-3",
                    "algorithmName": "green-alg",
                    "input": ["@green-1", "@green-2", true, 4, "bla", "flowInput.files1", { "data": "flowInput.files2" }],
                },
                {
                    "nodeName": "green-4",
                    "algorithmName": "green-alg",
                    "input": ["@green-1", "mooo", "@green-2", "mooo", "@green-3"]
                }
            ],
            "flowInput": {
                file: 'links-1',
                files1: ['links-1', 'links-2', 'links-3'],
                files2: ['links-4', 'links-5', 'links-6']
            },
            "Webhook": {
                "progressHook": "string",
                "resultHook": "string"
            }
        }
        const example3 = {
            "name": "string",
            "nodes": [
                // {
                //     "nodeName": "node-1",
                //     "algorithmName": "green-bla",
                //     "input": [{
                //         str: "flowInput.str",
                //         arrOfStr: ["flowInput.data2"],
                //         nestedObj: {
                //             b: {
                //                 c: ["flowInput.data2"]
                //             }
                //         },
                //         arrOfObjects: [{
                //             e: "flowInput.data2"
                //         }, {
                //             f: "flowInput.data2"
                //         }]
                //     }]
                // },
                {
                    "nodeName": "node-2",
                    "algorithmName": "green-bla",
                    "input": "flowInput.data1",
                    "batchInput": [1, 2, 3, 4],
                    "waitAll": true
                }
            ],
            "flowInput": {
                str: "my str",
                files1: ['links-1', 'links-2'],
                files2: ['links-3', 'links-4'],
                files3: ['links-1', 'links-2', 'links-3', 'links-4'],
                data1: "use this data 1",
                data2: "use this data 2"
            },
            "Webhook": {
                "progressHook": "string",
                "resultHook": "string"
            }
        }

        const client = createClient();
        const subscriber = createClient();

        const options = {
            createClient: function (type) {
                switch (type) {
                    case 'client':
                        return client;
                    case 'subscriber':
                        return subscriber;
                    default:
                        return createClient();
                }
            }
        }

        function createClient() {
            return config.redis.useCluster ? new Redis.Cluster([config.redis]) : new Redis(config.redis)
        }

        const setting = {};
        const res = validate(schema, setting);
        const p = new Producer(setting);
        setting.job.data = example2;
        p.createJob(setting);
        p.on('job-failed', (data) => {
            console.error(data.error);
        });
    }
}

module.exports = new Tests();

setTimeout(() => {
    stateManager.setDriverState({ key: 'pipeline-driver-job:1046d36f-41fd-49a1-85c6-144fdf7d2129', value: { status: 'stopped' } });
}, 10000);

//p.createJob(setting);
//p.createJob(setting);