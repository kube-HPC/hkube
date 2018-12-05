#!/usr/bin/env bash

ALGORITHM_NAME=$1
IMAGE_NAME=hkube/${ALGORITHM_NAME}
TAG_VER="${IMAGE_NAME}:latest"

echo ALGORITHM_NAME=${ALGORITHM_NAME}
echo IMAGE_NAME=${IMAGE_NAME}
echo TAG_VER=${TAG_VER}

echo docker login --username yehiyam --password ${DOCKER_HUB_PASS}

 docker build \
-t ${TAG_VER} \
--no-cache \
--build-arg BASE_PRIVATE_REGISTRY="${BASE_PRIVATE_REGISTRY}" \
--build-arg ALGORITHM_NAME="${ALGORITHM_NAME}" \
 -f ./builder/Dockerfile .

echo docker tag ${TAG_VER} "${TAG_CUR}"
echo docker push ${TAG_VER}