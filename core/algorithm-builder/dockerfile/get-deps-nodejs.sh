#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/nodejs/packages
cp $SCRIPTPATH/../environments/nodejs/wrapper/package.json $SCRIPTPATH/../environments/nodejs/packages/
echo downloading for nodejs
pushd .
cd $SCRIPTPATH/../environments/nodejs/wrapper
npm install  --prefix ../packages/ 
popd
