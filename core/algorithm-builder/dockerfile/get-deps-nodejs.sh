#!/bin/bash
set -exo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/nodejs/packages
cp $SCRIPTPATH/../environments/nodejs/wrapper/package.json $SCRIPTPATH/../environments/nodejs/packages/
echo downloading for nodejs
docker run --rm -u $(id -u ${USER}):$(id -g ${USER}) -v $SCRIPTPATH/../environments/nodejs/packages:/packages node:14.5.0 /bin/bash -c 'npm config get cache && npm install --cache /tmp/npmcache  --prefix /packages/'
