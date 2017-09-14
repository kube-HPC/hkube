
class Helper {

    tryParseJSON(json) {
        let parsed = json;
        try {
            parsed = JSON.parse(json);
        } catch (e) {
        }
        return parsed
    }

    jobKey(queueName, prefix, jobID) {
        return [queueName, prefix, jobID].join(':');
    }
}

module.exports = new Helper();