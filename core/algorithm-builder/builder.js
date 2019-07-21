#!/usr/bin/env node

const yargs = require('yargs');
const configIt = require('@hkube/config');
const Logger = require('@hkube/logger');
const config = configIt.load();
const log = new Logger(config.main.serviceName, config.logger);
const dockerBuild = require('./lib/builds/docker-builder');

const main = async () => {
  yargs.command({
    command: 'build',
    handler: async (argv) => {
      const ret = await dockerBuild.buildAlgorithmImage({
        docker: config.main.docker,
        algorithmName: argv.a,
        version: argv.v,
        buildPath: `environments/${argv.e}`,
        rmi: argv.rmi
      });
      console.log(ret.output.data);
    }
  })
    .demandCommand()
    .help()
    .argv;
};

main();
