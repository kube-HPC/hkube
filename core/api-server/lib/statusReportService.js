'use strict';

//var Etcd = require('etcd.rf');
//var etcd = new Etcd("http://localhost:4001");
//var options = { recursive: true };

var etcd = require('lib/utils/etcdRfSinglton.js');

class statusReportService {
    constructor() {
    }

    init(options) {
        // let watcher = etcd.watch.then(etcd => {
        //     etcd.watcher.on('set', d => console.log(`set:    ${JSON.stringify(d)}`))
        //     etcd.watcher.on('change', d => console.log(`change: ${JSON.stringify(d)}`));
        //     etcd.watcher.on('expire', d => console.log(`expire: ${JSON.stringify(d)})`));
        //     etcd.watcher.on('delete', d => console.log(`delete: ${JSON.stringify(d)}`));
        // });
    }
    // init(options) {
    //      let watcher = etcd.watch ("/PipelineJobs",options,(res)=>{
    //          console.log(res);
    //      }).on("change", (data) =>{
    //          //TODO: send REST message back to reporting webhook
    //          console.log  (data);
    //      })
    // }
}

//const {init,init2} = require('{init,init2}');


module.exports = new statusReportService()