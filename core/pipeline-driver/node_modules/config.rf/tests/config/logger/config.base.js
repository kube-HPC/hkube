var config = module.exports = {};

config.machineType = "config-it-test";

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