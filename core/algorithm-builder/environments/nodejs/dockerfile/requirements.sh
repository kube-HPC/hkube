#!/bin/sh

set -e

PACKAGES_REGISTRY_HOST=${packagesRegistry#http://}
PACKAGES_REGISTRY_HOST=${PACKAGES_REGISTRY_HOST#https://}

# export PACKAGES_REGISTRY=${packagesRegistry}
# PACKAGES_REGISTRY_HOST=${PACKAGES_REGISTRY#http://}
# export PACKAGES_REGISTRY_HOST=${PACKAGES_REGISTRY_HOST#https://}
# export PACKAGES_TOKEN=${packagesToken}
# export PACKAGES_AUTH=${packagesAuth}

# Save credentials for private registry
if [ -n "${packagesRegistry}" ]; then
    echo "found npm registry ${packagesRegistry}"
    if [ -n "${packagesToken}" ]; then
        echo "//${PACKAGES_REGISTRY_HOST}:_authToken=${packagesToken}" > ${HOME}/.npmrc
    elif [ -n "${packagesAuth}" ]; then
        echo "//${PACKAGES_REGISTRY_HOST}:_auth=${packagesAuth}" > ${HOME}/.npmrc
        echo "//${PACKAGES_REGISTRY_HOST}:always-auth=true" >> ${HOME}/.npmrc
    fi
fi

# if [ ! -z ${PACKAGES_REGISTRY} ]; then
#     echo "found npm registry ${PACKAGES_REGISTRY}"
#     if [ ! -z ${PACKAGES_TOKEN} ]; then
#         echo "//${PACKAGES_REGISTRY_HOST}:_authToken=${PACKAGES_TOKEN}" > ${HOME}/.npmrc
#     elif [ ! -z ${PACKAGES_AUTH} ]; then
#         echo "//${PACKAGES_REGISTRY_HOST}:_auth=${PACKAGES_AUTH}" > ${HOME}/.npmrc
#         echo "//${PACKAGES_REGISTRY_HOST}:always-auth=true" >> ${HOME}/.npmrc
#     fi
# fi

if [ -n "${dependency_install_cmd}" ]; then
    echo "found dependency install script"
    echo "running ${dependency_install_cmd} in folder ${PWD}"
    sh -c "cd ${PWD} && sh ${dependency_install_cmd}"
    echo "${dependency_install_cmd} execution done with code $?"
elif [ -n "${packagesRegistry}" ]; then
    if [ -f package-lock.json ]; then
        echo "Using npm ci (with registry)"
        npm ci --registry=${packagesRegistry}  # Faster and more reliable than install
    else
        npm install --registry=${packagesRegistry}
    fi
    rm -f ${HOME}/.npmrc
else
    echo "no npm credentials found"
    if [ -f package-lock.json ]; then
        echo "Using npm ci (no registry)"
        npm ci  # Falls back to faster install
    else
        npm install
    fi
fi

# if [ ! -z ${dependency_install_cmd} ]; then
#     echo "found dependency install script"
#     SCRIPT_CWD="${PWD}"
#     echo "running ${dependency_install_cmd} in folder ${SCRIPT_CWD}"
#     sh -c "cd ${SCRIPT_CWD} && sh ${dependency_install_cmd}"
#     echo "${dependency_install_cmd} execution done with code $?"
# elif [ ! -z ${PACKAGES_REGISTRY} ]; then
#     npm install --registry=${PACKAGES_REGISTRY}
#     rm -f .npmrc
# else
#     echo "no npm credentials found"
#     npm install
# fi
