#!/usr/bin/env bash

# This script used to create a specific base algorithm

source $PWD/lib/builds/build-utils.sh

usage(){
    echo "usage: [-e --env ] | [-v --ver] | -h --help]"
}

while [[ $# -gt 0 ]]
do
key="$1"

case $key in
    -e|--env)
    ENV="$2"
    shift
    shift
    ;;
    -v|--ver)
    VER="$2"
    shift
    shift
    ;;
    -h|--help)
    usage
    exit 1
    ;;
    *)
    usage
    exit 1
esac
done

NPM_VERSION=${npm_package_version}
VERSION="${VER:=${NPM_VERSION}}"
BUILD_PATH="environments/${ENV}"
IMAGE_NAME="hkube/base-algorithm-${ENV}:v${VERSION}"
DOCKER_FILE="Dockerfile"

if [ -z ${ENV} ]; then
  echo "Please choose env (python, nodejs, go)"
  exit -1
fi

echo IMAGE_NAME=${IMAGE_NAME}
echo DOCKER_REGISTRY=${DOCKER_REGISTRY}
echo BUILD_PATH=${BUILD_PATH}

echo

dockerLogin ${DOCKER_PULL_USER} ${DOCKER_PULL_PASS}

echo

dockerBuild ${IMAGE_NAME} ${BUILD_PATH} ${DOCKER_FILE}

dockerPush ${IMAGE_NAME}

removeImage ${IMAGE_NAME}

# update dockerfile template
sed -i "1s/.*/FROM \${DOCKER_PULL_REGISTRY}\/base-algorithm-${ENV}:v${VERSION}/" ${BUILD_PATH}/docker/DockerfileTemplate