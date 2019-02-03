#!/usr/bin/env bash

# This script used to create a specific base algorithm

ENV=$1
VER=$2

NPM_VERSION=${npm_package_version}
VERSION="${VER:=${NPM_VERSION}}"
BUILD_PATH="builders/environments/${ENV}"
IMAGE_NAME="hkube/base-algorithm-${ENV}:v${VERSION}"

if [ -z ${ENV} ]; then
  echo "Please choose env (python, node)"
  exit -1
fi

echo IMAGE_NAME=${IMAGE_NAME}
echo DOCKER_REGISTRY=${DOCKER_REGISTRY}
echo BUILD_PATH=${BUILD_PATH}

echo

if [[ ${DOCKER_REGISTRY_PASS} != "" ]]; then 
    echo "Found docker password, docker login...."
    echo ${DOCKER_REGISTRY_PASS} | docker login --username ${DOCKER_REGISTRY_USER} --password-stdin
else
    echo "Didn't find docker password, skip login...."
fi

echo

docker build \
-t ${IMAGE_NAME} \
--no-cache \
 -f ${BUILD_PATH}/builder/Dockerfile ${BUILD_PATH}

# docker push ${IMAGE_NAME}

# docker rmi ${IMAGE_NAME}