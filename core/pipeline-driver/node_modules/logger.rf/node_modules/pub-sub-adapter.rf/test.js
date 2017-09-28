/*
 * Created by nassi on 31/01/16.
 */

var PubSubAdapter = require('./lib/redis-adapter');

function test() {
    var self = this;
    this._pubSubAdapter = new PubSubAdapter({host: '127.0.0.1', port: 6379});
    this._pubSubAdapter.on('error', function (error) {
        console.log(error);
    });

    self._pubSubAdapter.requestReplySubscribe("RequestReplyTopic", (message, publishFunction) => {
        console.log("Request reply receiver message arrives -> " + message);
        publishFunction('response from receiver-topic');
    });

    self._pubSubAdapter.requestReply("RequestReplyTopic", "hello1").then((message) => {
        console.log("Request reply sender message arrives -> " + message);
    }).catch(function (error) {
        console.log(error);
    });
}

test();