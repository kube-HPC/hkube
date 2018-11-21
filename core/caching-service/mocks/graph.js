/* eslint-disable */
const graph = {
    "name": "DAG",
    "nodes": [
        {
            "nodeName": "A",
            "algorithmName": "eval-alg",
            "input": [
                1,
                "@flowInput.timeout"
            ],
            "extraData": {
                "code": [
                    "function sum(input) {",
                    "return new Promise((resolve,reject) => {",
                    "setTimeout(() => ",
                    "resolve(input[0] * 2)",
                    ",input[1])",
                    "});",
                    "}"
                ]
            }
        },
        {
            "nodeName": "B",
            "algorithmName": "eval-alg",
            "input": [
                "@A",
                "@flowInput.timeout"
            ],
            "extraData": {
                "code": [
                    "function sum(input) {",
                    "return new Promise((resolve,reject) => {",
                    "setTimeout(() => ",
                    "resolve(input[0] * 2)",
                    ",input[1])",
                    "});",
                    "}"
                ]
            }
        },
        {
            "nodeName": "C",
            "algorithmName": "eval-alg",
            "input": [
                "@B",
                "@flowInput.timeout"
            ],
            "extraData": {
                "code": [
                    "function sum(input) {",
                    "return new Promise((resolve,reject) => {",
                    "setTimeout(() => ",
                    "resolve(input[0] * 2)",
                    ",input[1])",
                    "});",
                    "}"
                ]
            }
        },
        {
            "nodeName": "D",
            "algorithmName": "eval-alg",
            "input": [
                "@B",
                "@G",
                "@flowInput.timeout"
            ],
            "extraData": {
                "code": [
                    "function sum(input) {",
                    "return new Promise((resolve,reject) => {",
                    "setTimeout(() => ",
                    "resolve(input[0] * 2)",
                    ",input[2])",
                    "});",
                    "}"
                ]
            }
        },
        {
            "nodeName": "E",
            "algorithmName": "eval-alg",
            "input": [
                "@B",
                "@C",
                "@D",
                "@flowInput.timeout"
            ],
            "extraData": {
                "code": [
                    "function sum(input) {",
                    "return new Promise((resolve,reject) => {",
                    "setTimeout(() => ",
                    "resolve(input[0] * 2)",
                    ",input[3])",
                    "});",
                    "}"
                ]
            }
        },
        {
            "nodeName": "F",
            "algorithmName": "eval-alg",
            "input": [
                "@E",
                "@flowInput.timeout"
            ],
            "extraData": {
                "code": [
                    "function sum(input) {",
                    "return new Promise((resolve,reject) => {",
                    "setTimeout(() => ",
                    "resolve(input[0] * 2)",
                    ",input[1])",
                    "});",
                    "}"
                ]
            }
        },
        {
            "nodeName": "G",
            "algorithmName": "eval-alg",
            "input": [
                1,
                "@flowInput.timeout"
            ],
            "extraData": {
                "code": [
                    "function sum(input) {",
                    "return new Promise((resolve,reject) => {",
                    "setTimeout(() => ",
                    "resolve(input[0] * 2)",
                    ",input[1])",
                    "});",
                    "}"
                ]
            }
        }
    ],
    "flowInput": {
        "timeout": 5000
    },
    "options": {
        "ttl": 3600,
        "batchTolerance": 80,
        "progressVerbosityLevel": "info"
    },
    "priority": 3
}


module.exports = {graph};