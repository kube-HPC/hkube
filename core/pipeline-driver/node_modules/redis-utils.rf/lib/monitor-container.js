/*
 * Created by nassi on 21/03/16.
 * This simple tool is designed to check data-store connectivity.
 */

function MonitorContainer(monitor) {
    this.monitor = monitor;
}

module.exports = MonitorContainer;

MonitorContainer.prototype.check = function check(options) {
    return this.monitor.check(options);
};