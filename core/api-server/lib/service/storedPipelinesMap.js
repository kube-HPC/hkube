const pipelines = module.exports = {};

pipelines.myFlow = {
    "name": "myFlow",
    "nodes": [
        {
            "nodeName": "green-1",
            "algorithmName": "green-bla",
            "input": ["@flowInput.files1"]
        },
        // {
        //     "nodeName": "green-2",
        //     "algorithmName": "green-bla",
        //     "input": ["@green-1.data.result", '{a:green-1.data.res.final, b:green-1.c}', "mooo"]
        // },
        // {
        //     "nodeName": "green-3",
        //     "algorithmName": "green-bla",
        //     "input": ["@green-1", "mooo", "@green-2"]
        // },
        // {
        //     "nodeName": "green-4",
        //     "algorithmName": "green-bla",
        //     "input": ["@green-1", "mooo", "@green-2", "mooo", "@green-3"]
        // }
    ],
    "flowInput": {
        file: 'links-1',
        files1: ['links-1', 'links-2', 'links-3', 'links-4'],
        files2: ['links-4', 'links-5', 'links-6']
    },
    "Webhook": {
        "progressHook": "string",
        "resultHook": "string"
    }
};