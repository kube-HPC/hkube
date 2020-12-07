#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/nodejs/packages
cp $SCRIPTPATH/../environments/nodejs/wrapper/package.json $SCRIPTPATH/../environments/nodejs/packages/
echo downloading for nodejs
docker run --rm -u $(id -u ${USER}):$(id -g ${USER}) -v $SCRIPTPATH/../environments/nodejs/packages:/packages -v $SCRIPTPATH/../environments/nodejs/wrapper:/wrapper node:14.5.0 npm install  --prefix /packages/
