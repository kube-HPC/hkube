const client = require('prom-client');

class PrometheusClient{
    async init(){
        const collectDefaultMetrics = client.collectDefaultMetrics;
        collectDefaultMetrics({ timeout: 5000 });

    }

    metrics(){
        return client.register.metrics();
    }
}

module.exports = new PrometheusClient();