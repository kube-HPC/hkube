module.exports = {
    "name": "options",
    "type": "object",
    "properties": {
        "job": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "default": "pipeline-driver-job",
                    "description": "the job type of this driver"
                }
            }
        },
        "setting": {
            "type": "object",
            "properties": {
                "queueName": {
                    "type": "string",
                    "default": "queue-pipeline",
                    "description": "the queue name"
                },
                "prefix": {
                    "type": "string",
                    "default": "jobs-pipeline",
                    "description": "prefix for all queue keys"
                }
            }
        }
    }
}