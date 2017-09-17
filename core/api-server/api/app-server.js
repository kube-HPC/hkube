var express = require('express')
var app = express();

var VERSIONS = ['/v1', '/v2'];

app.get('/api', function (req, res) {
    res.json(VERSIONS);
})

for (let v of VERSIONS) {
    app.use(v, require('./routes' + v + '/route.js'));
}

app.listen(3000);