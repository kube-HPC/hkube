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

printEnvs(){
  echo
  echo IMAGE_NAME=${IMAGE_NAME}
  echo BUILD_PATH=${BUILD_PATH}
  echo BASE_IMAGE=${BASE_IMAGE}
  echo WRAPPER_VERSION=${WRAPPER_VERSION}
  echo DOCKER_PULL_REGISTRY=${DOCKER_PULL_REGISTRY}
  echo INSECURE_PULL=${INSECURE_PULL:-"false"}
  echo SKIP_TLS_VERIFY_PULL=${SKIP_TLS_VERIFY_PULL:-"false"}
  echo DOCKER_PUSH_REGISTRY=${DOCKER_PUSH_REGISTRY}
  echo SKIP_TLS_VERIFY=${SKIP_TLS_VERIFY:-"false"}
  echo INSECURE=${INSECURE:-"false"}
  echo PACKAGES_REGISTRY=${PACKAGES_REGISTRY}
  echo REMOVE_IMAGE=${REMOVE_IMAGE}
  echo TMP_FOLDER=${TMP_FOLDER}
  echo
}

dockerBuildOpenshift() {
  export image=${IMAGE_NAME}
  export buildPath=${BUILD_PATH}
  export workspace="${TMP_FOLDER}/workspace"
  export commands="${TMP_FOLDER}/commands"
  export baseImage=${BASE_IMAGE}
  export packagesRegistry=${PACKAGES_REGISTRY}
  export packagesRegistryUser=${PACKAGES_REGISTRY_USER}
  export packagesToken=${PACKAGES_TOKEN}

  echo "Building image ${image}"
  echo copy context from ${buildPath} to ${workspace}
  cp -r ${buildPath}/* ${workspace}
  
  envsubst < ${workspace}/dockerfile/DockerfileTemplate > ${workspace}/dockerfile/Dockerfile
  sed -i '/^ARG /d' ${workspace}/dockerfile/Dockerfile

  echo BUILD_ID=${BUILD_ID}
  echo '#!/bin/bash' > ${commands}/run
  echo 'set -o pipefail' >> ${commands}/run
  echo 'oc login \
  --certificate-authority=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt \
  --token=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token) \
  ${KUBERNETES_SERVICE_HOST}:${KUBERNETES_SERVICE_PORT} -n ${NAMESPACE}'  >> ${commands}/run
  echo "oc apply -f /commands/buildConfig.yaml" >> ${commands}/run
  echo "oc apply -f /commands/dockerCredsSecret.yaml" >> ${commands}/run
  echo "oc secrets link builder build-registry-secret" >> ${commands}/run
  echo "oc start-build ${BUILD_ID} --from-dir /workspace/ --follow --wait" >>${commands}/run

  chmod +x ${commands}/run
  touch ${commands}/output
  touch ${commands}/start
  tail -f ${commands}/output& PID=$!
  disown ${PID}
  while [ ! -f "${commands}/done" ]; do
    sleep 1s
  done

  kill ${PID}
  echo build done
  if [ -f "${commands}/code_ok" ]; then
    exit_code=0
  else
    exit_code=1
  fi
}

dockerBuildKaniko() {
  export image=${IMAGE_NAME}
  export buildPath=${BUILD_PATH}
  export workspace="${TMP_FOLDER}/workspace"
  export commands="${TMP_FOLDER}/commands"
  export baseImage=${BASE_IMAGE}
  export packagesRegistry=${PACKAGES_REGISTRY}
  export packagesRegistryUser=${PACKAGES_REGISTRY_USER}
  export packagesToken=${PACKAGES_TOKEN}
  export packagesAuth=${PACKAGES_AUTH}
  export insecure=${INSECURE}
  export insecure_pull=${INSECURE_PULL}
  export skip_tls_verify=${SKIP_TLS_VERIFY}
  export skip_tls_verify_pull=${SKIP_TLS_VERIFY_PULL}
  export dependency_install_cmd=${DEPENDENCY_INSTALL_CMD}

  echo "Building image ${image}"
  echo copy context from ${buildPath} to ${workspace}
  cp -r ${buildPath}/* ${workspace}
  
  envsubst < ${workspace}/dockerfile/DockerfileTemplate > ${workspace}/dockerfile/Dockerfile

  options=""
  if [[ $insecure == true ]]; then options="${options} --insecure"; fi
  if [[ $insecure_pull == true ]]; then options="${options} --insecure-pull"; fi
  if [[ $skip_tls_verify == true ]]; then options="${options} --skip-tls-verify"; fi
  if [[ $skip_tls_verify_pull == true ]]; then options="${options} --skip-tls-verify-pull"; fi
  if [[ $NO_PUSH == true ]]; then options="${options} --no-push"; fi
  echo "/kaniko/executor \
    --dockerfile ./dockerfile/Dockerfile \
    ${options} --context dir:///workspace/ \
    --build-arg packagesRegistry=${packagesRegistry} \
    --build-arg packagesRegistryUser=${packagesRegistryUser} \
    --build-arg packagesToken=${packagesToken} \
    --build-arg baseImage=${baseImage} \
    --build-arg dependency_install_cmd=${dependency_install_cmd} \
    --destination $image" > ${commands}/run
  
  chmod +x ${commands}/run
  touch ${commands}/output
  touch ${commands}/start
  tail -f ${commands}/output& PID=$!
  disown ${PID}
  while [ ! -f "${commands}/done" ]; do
    sleep 1s
  done

  kill ${PID}
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