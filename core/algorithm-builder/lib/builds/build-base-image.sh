#!/usr/bin/env bash

# This script used to create a specific base algorithm

source $PWD/lib/builds/build-utils.sh

ENV=$1
VER=$2

NPM_VERSION=${npm_package_version}
VERSION="${VER:=${NPM_VERSION}}"
BUILD_PATH="environments/${ENV}"
IMAGE_NAME="hkube/base-algorithm-${ENV}:v${VERSION}"

if [ -z ${ENV} ]; then
  echo "Please choose env (python, nodejs, go)"
  exit -1
fi

echo IMAGE_NAME=${IMAGE_NAME}
echo DOCKER_REGISTRY=${DOCKER_REGISTRY}
echo BUILD_PATH=${BUILD_PATH}

echo

dockerLogin

echo

dockerBuild

docker push ${IMAGE_NAME}

# docker rmi ${IMAGE_NAME}