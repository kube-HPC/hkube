/*
 * Created by nassi on 27/03/16.
 */


var MonitorContainer = require('./lib/monitor-container');
var Monitor = require('./lib/redis-monitor');

module.exports.Monitor = new MonitorContainer(new Monitor()).monitor;
module.exports.Factory = require('./lib/redis-factory');