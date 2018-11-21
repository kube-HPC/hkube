/* eslint-disable */
const pipeline = {
    "name": "resultBatch",
    "nodes": [
        {
            "nodeName": "red",
            "algorithmName": "red-alg",
            "input": [
                "#@yellow.data",
                512
            ],
            caching: [{
                node: 'yellow',
                type: 'waitNode',//waitNode
                result: {
                    "metadata": {
                        "yellow": { type: "array", size: 5 }
                    },
                    "storageInfo": {
                        "Key": "yellow:yellow-alg:bde23282-4a20-4a13-9d5c-a1e9cd4a696a",
                        "Bucket": "batch-5b0b25a1-5364-4bd6-b9b0-126de5ed2227",
                        "path": 'link_to_data'
                    }
                }
            }]
        }
    ]
};