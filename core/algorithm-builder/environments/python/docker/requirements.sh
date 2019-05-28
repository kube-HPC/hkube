#!/bin/bash

set -e

BUILD_PATH=$1

cd $BUILD_PATH

if [ -f ./requirements.txt ]; then
     echo found requirements.txt
     pip3 install -r ./requirements.txt
else
     echo no requirements.txt found
fi