#!/usr/bin/env bash

ENV=$1
BUILD=../environments/${ENV}/builder

echo "starting build for environment: ${ENV}"

pushd $BUILD

./builder.sh

popd