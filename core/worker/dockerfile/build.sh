#!/usr/bin/env bash
REPO_NAME=$1
#IMAGE_NAME=private.registry:5000/sound/${REPO_NAME}
IMAGE_NAME=sound/${REPO_NAME}
if [ -n "$2" ]
then
  VERSION_TYPE=$2
else
  VERSION_TYPE="patch"
fi

VERSION="${npm_package_version}"
TAG_VER="${IMAGE_NAME}:${VERSION}"
TAG_CUR="${IMAGE_NAME}:latest"

docker build -t ${TAG_VER} -t ${TAG_CUR} -f ./dockerfile/Dockerfile .
#docker push ${TAG_VER}
#docker push ${TAG_CUR}

