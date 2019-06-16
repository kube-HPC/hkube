#!/usr/bin/env bash

dockerLogin() {
  user=$1
  pass=$2

  if [[ ${user} != "" ]]; then 
    echo "Found docker password, docker login...."
    echo ${pass} | docker login --username ${user} --password-stdin
  else
    echo "Didn't find docker password, skip login...."
  fi
}

dockerBuild() {
  image=$1
  buildPath=$2
  dockerFile=$3

  echo "Building image ${image}"
  docker build \
  --force-rm \
  --network=host \
  -t ${image} \
  -f ${buildPath}/docker/${dockerFile} ${buildPath}
}

dockerPush() {
  image=$1
  echo "Pushing image ${image}"
  docker push ${image}
}

removeImage() {
  image=$1
  remove=$2

  if [[ ${remove} == "True" ]]; then
    echo "Removing image ${image}"
    docker rmi ${image}
  else
    echo "Skip image removal for ${image}"
  fi
}