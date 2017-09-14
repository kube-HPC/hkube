module.exports = {
    "name": "options",
    "type": "object",
    "properties": {
        "setting": {
            "type": "object",
            "properties": {
                "queueName": {
                    "type": "string",
                    "default": "queue-workers",
                    "description": "the queue name"
                },
                "prefix": {
                    "type": "string",
                    "default": "jobs-workers",
                    "description": "prefix for all queue keys"
                }
            }
        }
    }
}