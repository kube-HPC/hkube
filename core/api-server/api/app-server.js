var express = require('express')
var app = express();
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');
var VERSIONS = ['/v1', '/v2'];


app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

for (let v of VERSIONS) {
    app.use(v, require('./routes' + v + '/route.js'));
}
for (let v of VERSIONS) {
    app.use(v, require('./run' + v + '/run.js'));
}


app.get('/api', function (req, res) {
    res.json(VERSIONS);
})


app.listen(3000);