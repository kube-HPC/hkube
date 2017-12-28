const getOptionOrDefault = (opts, optionName, defaultValue) => {
    opts = opts || [];
    let optionPair;
    if (Array.isArray(optionName)) {
        optionPair = opts.find(o => optionName.findIndex(opt=>opt===o[0])>=0);
    }
    else {
        optionPair = opts.find(o => o[0] === optionName);
    }
    if (!optionPair) {
        return defaultValue;
    }
    let option = optionPair[1];
    if (option === true) {
        return defaultValue;
    }
    return option;
}

module.exports={
    getOptionOrDefault
}