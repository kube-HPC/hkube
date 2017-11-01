module.exports = {
    "name": "options",
    "type": "object",
    "properties": {
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