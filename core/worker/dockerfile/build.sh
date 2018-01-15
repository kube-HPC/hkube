#!/usr/bin/env bash
REPO_NAME=$1
if [ -v PRIVATE_REGISTRY ]
then
  IMAGE_NAME=${PRIVATE_REGISTRY}/${REPO_NAME}
else
  IMAGE_NAME=hkube/${REPO_NAME}
fi

VERSION="v${npm_package_version}"
if [ "${TRAVIS_PULL_REQUEST}" != "false" ]; then
  VERSION=${VERSION}-${TRAVIS_PULL_REQUEST_BRANCH}-${TRAVIS_JOB_NUMBER}
fi
TAG_VER="${IMAGE_NAME}:${VERSION}"

docker build -t ${TAG_VER} -f ./dockerfile/Dockerfile .
if [ "${TRAVIS_PULL_REQUEST}" == "false" ] || [ -z "${TRAVIS_PULL_REQUEST}" ]; then
  TAG_CUR="${IMAGE_NAME}:latest"
  docker tag ${TAG_VER} "${TAG_CUR}"
fi

if [ -v PRIVATE_REGISTRY ]
then
  echo docker push ${TAG_VER}
  docker push ${TAG_VER}
  if [[ -v TAG_CUR ]]; then
    echo docker push ${TAG_CUR}
    docker push ${TAG_CUR}
  fi
fi

