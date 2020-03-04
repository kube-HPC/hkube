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

dockerBuildOpenshift() {
  image=$1
  buildPath=$2
  workspace=${3:-/workspace}
  commands=${4:-/commands}
  export baseImage=$5
  export packagesRegistry=$6
  export packagesToken=$7
  insecure=${8}
  insecure_pull=${9}
  skip_tls_verify=${10}
  skip_tls_verify_pull=${11}

  echo "Building image ${image}"
  echo copy context from ${buildPath} to ${workspace}
  cp -r ${buildPath}/* ${workspace}
  # echo copy docker creds
  # cp ~/.docker/config.json ${commands}/
  
  envsubst < ${workspace}/dockerfile/DockerfileTemplate > ${workspace}/dockerfile/Dockerfile
  sed -i '/^ARG /d' ${workspace}/dockerfile/Dockerfile
  options=""
  if [[ $insecure == true ]]; then options="${options} --insecure"; fi
  if [[ $insecure_pull == true ]]; then options="${options} --insecure-pull"; fi
  if [[ $skip_tls_verify == true ]]; then options="${options} --skip-tls-verify"; fi
  if [[ $skip_tls_verify_pull == true ]]; then options="${options} --skip-tls-verify-pull"; fi
  echo BUILD_ID=${BUILD_ID}
  echo '#!/bin/bash' > ${commands}/run
  echo 'set -o pipefail' >> ${commands}/run
  echo 'oc login \
  --certificate-authority=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  --token=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token) \
  ${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT}'  >> ${commands}/run
  echo "oc apply -f /commands/buildConfig.yaml" >> ${commands}/run
  echo "oc apply -f /commands/imageStream.yaml" >> ${commands}/run
  echo "oc start-build ${BUILD_ID} --from-dir /workspace/ --follow --wait" >>${commands}/run
  # echo "oc delete -f /commands/buildConfig.yaml" >> ${commands}/run

  chmod +x ${commands}/run
  touch ${commands}/output
  touch ${commands}/start
  tail -f ${commands}/output& PID=$!
  while [ ! -f "${commands}/done" ]; do
    sleep 1s
  done

  kill $PID
  echo build done
  if [ -f "${commands}/code_ok" ]; then
    exit_code=0
  else
    exit_code=1
  fi
}

dockerBuildKaniko() {
  image=$1
  buildPath=$2
  workspace=${3:-/workspace}
  commands=${4:-/commands}
  baseImage=$5
  packagesRegistry=$6
  packagesToken=$7
  insecure=${8}
  insecure_pull=${9}
  skip_tls_verify=${10}
  skip_tls_verify_pull=${11}

  echo "Building image ${image}"
  echo copy context from ${buildPath} to ${workspace}
  cp -r ${buildPath}/* ${workspace}
  # echo copy docker creds
  # cp ~/.docker/config.json ${commands}/
  options=""
  if [[ $insecure == true ]]; then options="${options} --insecure"; fi
  if [[ $insecure_pull == true ]]; then options="${options} --insecure-pull"; fi
  if [[ $skip_tls_verify == true ]]; then options="${options} --skip-tls-verify"; fi
  if [[ $skip_tls_verify_pull == true ]]; then options="${options} --skip-tls-verify-pull"; fi
  
  echo "/kaniko/executor \
    --dockerfile ./dockerfile/DockerfileTemplate \
    ${options} --context dir:///workspace/ \
    --build-arg packagesRegistry=${packagesRegistry} \
    --build-arg packagesToken=${packagesToken} \
    --build-arg baseImage=${baseImage} \
    --destination $image" > ${commands}/run
  
  chmod +x ${commands}/run
  touch ${commands}/output
  touch ${commands}/start
  tail -f ${commands}/output& PID=$!
  while [ ! -f "${commands}/done" ]; do
    sleep 1s
  done

  kill $PID
  echo build done
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
  -f ${buildPath}/dockerfile/${dockerFile} ${buildPath}
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