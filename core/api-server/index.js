'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const app = require('connect')();

const swaggerTools = require('swagger-tools');
const jsyaml = require('js-yaml');

const serverPort = 3000;

//log initialization

const configrf = require('config.rf');
const Logger = require('logger.rf');
const componentName = require('./common/consts/componentNames');

configrf.load().then(value => {
  let log = new Logger(value.main.serviceName, value.logger);
  
  // swaggerRouter configuration
  const options = {
    swaggerUi: path.join(__dirname, '/swagger.json'),
    controllers: path.join(__dirname, './controllers'),
    useStubs: process.env.NODE_ENV === 'development' // Conditionally turn on stubs (mock mode)
  };
  
  // The Swagger document (require it, build it programmatically, fetch it from a URL, ...)
  let spec = fs.readFileSync(path.join(__dirname,'api/swagger.yaml'), 'utf8');
  let swaggerDoc = jsyaml.safeLoad(spec);
  
  // Initialize the Swagger middleware
  swaggerTools.initializeMiddleware(swaggerDoc, function (middleware) {
  
    log.info('running application in ' + configrf.env() + ' environment', { component: componentName.MAIN });
  
    // Interpret Swagger resources and attach metadata to request - must be first in swagger-tools middleware chain
    app.use(middleware.swaggerMetadata());
  
    // Validate Swagger requests
    app.use(middleware.swaggerValidator());
  
    // Route validated requests to appropriate controller
    app.use(middleware.swaggerRouter(options));
  
    // Serve the Swagger documents and Swagger UI
    app.use(middleware.swaggerUi());
  
    // Start the server
    http.createServer(app).listen(serverPort, function () {
      console.log('Your server is listening on port %d (http://localhost:%d)', serverPort, serverPort);
      console.log('Swagger-ui is available on http://localhost:%d/docs', serverPort);
    });
  
  });
  
}).catch(err=>{
  log.info('error occured in app initialization. exiting. ( ' + err + ')', { component: componentName.MAIN });
  process.exit(-1);
});
