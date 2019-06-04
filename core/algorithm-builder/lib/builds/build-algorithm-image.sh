#!/usr/bin/env bash

# This script used to create a specific algorithm image

source $PWD/lib/builds/build-utils.sh

IMAGE_NAME=$1
DOCKER_REGISTRY=$2
DOCKER_REGISTRY_USER=$3
DOCKER_REGISTRY_PASS=$4
BUILD_PATH=$5

echo docker version
docker version
echo

echo Operating System Details
cat /etc/os-release
echo

echo IMAGE_NAME=${IMAGE_NAME}
echo DOCKER_REGISTRY=${DOCKER_REGISTRY}
echo BUILD_PATH=${BUILD_PATH}

echo

dockerLogin

DOCKER_REGISTRY=${DOCKER_REGISTRY} envsubst < ${BUILD_PATH}/docker/DockerfileTemplate > ${BUILD_PATH}/docker/Dockerfile
echo

dockerBuild

docker push ${IMAGE_NAME}

docker rmi -f ${IMAGE_NAME}