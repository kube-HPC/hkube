//this module is just to make the client singleton

//TODO: take initialization params from config
const etcdRfSinglton = require('etcd.rf');
var options = { recursive: true };
module.exports = new etcdRfSinglton().init(options);