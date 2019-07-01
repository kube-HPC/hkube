#!/usr/bin/env bash

dockerLogin() {
  user=$1
  pass=$2
  registry=$3
  if [[ ${registry} == docker.io* ]]; then
    echo found docker hub. remove registry
    registry=""
  fi

  if [[ ${user} != "none" ]] && [[ ${pass} != "none" ]]; then 
    echo "Found docker password, docker login...."
    echo ${pass} | docker login --username ${user} --password-stdin $registry
  else
    echo "Didn't find docker password, skip login...."
  fi
}

dockerBuildKaniko() {
  image=$1
  buildPath=$2
  dockerFile=$3
  workspace=${4:-/workspace}
  commands=${5:-/commands}
  echo "Building image ${image}"
  echo copy context from ${buildPath} to ${workspace}
  cp -r ${buildPath}/* ${workspace}
  # echo copy docker creds
  # cp ~/.docker/config.json ${commands}/
  echo "/kaniko/executor --dockerfile ./docker/__DockerFile__ --insecure --insecure-pull --context dir:///workspace/ --destination $image" > ${commands}/run
  chmod +x ${commands}/run
  cat ${commands}/run
  touch ${commands}/start
  while [ ! -f "${commands}/done" ]; do
    # echo "done file does not exist"
    sleep 1s
  done
  echo build done
  cat ${commands}/output
  # >&2 cat ${commands}/errors
  if [ -f "${commands}/code_ok" ]; then
    exit_code=0
  else
    exit_code=1
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