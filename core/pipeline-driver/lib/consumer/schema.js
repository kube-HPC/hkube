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
                "prefix": {
                    "type": "string",
                    "default": "jobs-pipeline",
                    "description": "prefix for all queue keys"
                }
            }
        }
    }
}