#!/usr/bin/env bash
REPO_NAME=$1
if [ -v PRIVATE_REGISTRY ]
then
  IMAGE_NAME=${PRIVATE_REGISTRY}/${REPO_NAME}
else
  IMAGE_NAME=sound/${REPO_NAME}
fi

VERSION="${npm_package_version}"
TAG_VER="${IMAGE_NAME}:${VERSION}"
TAG_CUR="${IMAGE_NAME}:latest"

docker build -t ${TAG_VER} -t ${TAG_CUR} -f ./dockerfile/Dockerfile .
if [ -v PRIVATE_REGISTRY ]
then
  docker push ${TAG_VER}
  docker push ${TAG_CUR}
fi

