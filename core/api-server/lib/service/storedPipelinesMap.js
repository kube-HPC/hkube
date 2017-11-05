

module.exports = {
    "name": "myFlow",
    "nodes": [
        {
            "nodeName": "green",
            "algorithmName": "green-alg",
            "input": ["#@flowInput.files.links1"],
        },
        {
            "nodeName": "yellow",
            "algorithmName": "yellow-alg",
            "input": ["@green"]
        },
        {
            "nodeName": "black",
            "algorithmName": "black-alg",
            "input": ["@green", "@yellow"]
        },
        // {
        //     "nodeName": "black",
        //     "algorithmName": "black-alg",
        //     "input": ["#['@green','@green']", "@green.data.result", "flowInput.files1"]
        // }
    ],
    "batchTolerance": 90,
    "flowInput": {
        "files": {
            "link": 'links-1',
            "links1": ['links-1', 'links-2', 'links-3'],
            "links2": ['links-4', 'links-5', 'links-6']
        }
    },
    "webhook": {
        "progressHook": "http://localhost:9988/webhook/progress",
        "resultHook": "http://localhost:9988/webhook/result"
    }
};
