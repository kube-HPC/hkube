const Regex = {
    URL_REGEX: /^(f|ht)tps?:\/\//i,
    PIPELINE_NAME_REGEX: /^[:\-_.A-Za-z0-9]+$/i,
    EXPERIMENT_NAME_REGEX: /^[:\-_.A-Za-z0-9]+$/i,
    ALGORITHM_NAME_REGEX: /^[a-z0-9][-a-z0-9\\.]*[a-z0-9]$/,
    PVC_NAME_REGEX: /^[a-z0-9][-a-z0-9\\.]*[a-z0-9]$/,
    ALGORITHM_IMAGE_REGEX: /^\S*$/,
    BOARD_ID: /^[a-z0-9][-a-z0-9\\.]*[a-z0-9]$/,
    PATH: /^([A-Za-z0-9.\\-|/])*[^\s]\1*$/
};

module.exports = Regex;
