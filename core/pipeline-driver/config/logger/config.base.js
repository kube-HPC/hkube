var config = module.exports = {};

config.transport = {
    console: true,
    logstash: false,
    file: false
};

config.logstash = {
    logstashPort: 28777
};

config.extraDetails = false;
config.isDefault = true;
