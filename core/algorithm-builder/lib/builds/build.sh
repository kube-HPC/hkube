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
cat /etc/os-release
echo

echo IMAGE_NAME=${IMAGE_NAME}
echo DOCKER_REGISTRY=${DOCKER_REGISTRY}
echo BUILD_PATH=${BUILD_PATH}

echo

if [ -z DOCKER_REGISTRY_PASS ]
then
    echo "Found docker password, docker login...."
    echo ${DOCKER_REGISTRY_PASS} | docker login --username ${DOCKER_REGISTRY_USER} --password-stdin
fi

DOCKER_REGISTRY=${DOCKER_REGISTRY} envsubst < ${BUILD_PATH}/builder/DockerfileTemplate > ${BUILD_PATH}/builder/Dockerfile
echo

docker build \
-t ${IMAGE_NAME} \
--no-cache \
 -f ${BUILD_PATH}/builder/Dockerfile ${BUILD_PATH}

docker push ${IMAGE_NAME}

docker rmi ${IMAGE_NAME}