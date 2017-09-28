/*
 * Created by nassi on 21/03/16.
 */

var common = require('./index');
var redisMonitor = common.Monitor;
var options = {host: '127.0.0.1', port: 6379};

redisMonitor.on('ready', function (data) {
    console.log('redis server is ready at ' + data.client.options.host + ':' + data.client.options.port);
});

redisMonitor.on('close', function (data) {
    console.log(data.error.message);
});

redisMonitor.check(options).then(function () {
    console.log('promise resolved');
}).catch(function (error) {
    console.log(error.message);
});