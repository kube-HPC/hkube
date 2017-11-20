const client = require('prom-client');

class PrometheusClient{
    async init(){
        const collectDefaultMetrics = client.collectDefaultMetrics;
        collectDefaultMetrics({ timeout: 5000 });
        this._httpRequestDurationMicroseconds = new client.Histogram({
            name: 'http_request_duration_ms',
            help: 'Duration of HTTP requests in ms',
            labelNames: ['method', 'route', 'code'],
            buckets: [0.10, 5, 15, 50, 100, 200, 300, 400, 500]  // buckets for response time from 0.1ms to 500ms
        });
        this._requestCounter = new client.Counter({
            name: 'request_counter',
            help: 'Total number of requests',
            labelNames: ['method', 'route','code']
        });
    }

    metrics(){
        return client.register.metrics();
    }
    httpRequestDurationMicroseconds({method,route,code,duration}){
        this._httpRequestDurationMicroseconds
            .labels(method, route, code)
            .observe(duration);
    }
    requestCounter({method,path,code}){
        this._requestCounter.inc({method, path, code});
    }

}

module.exports = new PrometheusClient();