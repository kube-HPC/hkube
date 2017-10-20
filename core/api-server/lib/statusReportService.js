'use strict';

//var Etcd = require('node-etcd');
//var etcd = new Etcd("http://localhost:4001");
//var options = { recursive: true };

var etcd = require('utils/etcdRfSinglton.js');

class statusReportService {
    constructor() {
        //let watcher = etcd.watch ("/PipelineJobs",,(res)=>{
        //    console.log(res);
        //}).on("change", (data) =>{
        //    //TODO: send REST message back to reporting webhook
        //    console.log  (data);
        //})
    }
    init(options) {
        //let watcher = etcd.watch ("/PipelineJobs",,(res)=>{
        //    console.log(res);
        //}).on("change", (data) =>{
        //    //TODO: send REST message back to reporting webhook
        //    console.log  (data);
        //})
    }
}

//const {init,init2} = require('{init,init2}');


module.exports = new statusReportService()