#!/bin/bash

set -e

PACKAGES_REGISTRY=$1
PACKAGES_TOKEN=$2
REQUIRMENTS=./algorithm_unique_folder/requirements.txt
TRUSTED_HOST=pypi.python.org

# We use --extra-index-url to allow pip to keep the original Index URL. 
# This allows pip to implicitly install public packages that your private package may depend on.

if [ -f ${REQUIRMENTS} ]; then
     echo "found requirements.txt"
     if [[ ${PACKAGES_REGISTRY} != "" ]]; then
          echo "found pip registry ${PACKAGES_REGISTRY}"
          pip3 install --trusted-host ${TRUSTED_HOST} --trusted-host ${PACKAGES_REGISTRY} --extra-index-url ${PACKAGES_REGISTRY} -r ${REQUIRMENTS}
     else
          pip3 install --trusted-host ${TRUSTED_HOST} -r ${REQUIRMENTS}
     fi
else
     echo "no requirements.txt found"
fi