class JsonHelper {
    tryParseJSON(json) {
        let parsed = json;
        try {
            parsed = JSON.parse(json);
        }
        catch (e) { // eslint-disable-line
        }
        return parsed;
    }
}

module.exports = new JsonHelper();
