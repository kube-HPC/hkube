#!/usr/bin/env bash

ENV=$1
DIR=$(cd $(dirname ${BASH_SOURCE[0]}) && pwd)
BUILD=$DIR/../environments/${ENV}/builder

echo "starting build for environment: ${ENV}"

pushd $BUILD

./builder.sh

popd