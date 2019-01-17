#!/usr/bin/env bash

IMAGE_NAME=$1
DOCKER_REGISTRY=$2
DOCKER_REGISTRY_USER=$3
DOCKER_REGISTRY_PASS=$4
BUILD_PATH=$5

echo docker version
docker version
echo

echo Operating System Details
# cat /etc/lsb-release
cat /etc/os-release
echo


echo IMAGE_NAME=${IMAGE_NAME}
echo DOCKER_REGISTRY=${DOCKER_REGISTRY}
echo BUILD_PATH=${BUILD_PATH}

echo

echo docker login --username ${DOCKER_REGISTRY_USER} --password ${DOCKER_REGISTRY_PASS}

 docker build \
-t ${IMAGE_NAME} \
--no-cache \
--build-arg DOCKER_REGISTRY="${DOCKER_REGISTRY}" \
--build-arg BUILD_PATH="${BUILD_PATH}" \
 -f ${BUILD_PATH}/builder/Dockerfile ${BUILD_PATH}

echo docker push ${IMAGE_NAME}

echo docker rmi ${IMAGE_NAME}