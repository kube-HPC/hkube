const tryParse = (json) => {
    let parsed;
    try {
        parsed = JSON.parse(json);
    }
    catch (e) {
        parsed = null;
    }
    return parsed || {};
};

module.exports = tryParse;
