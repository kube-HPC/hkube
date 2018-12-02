#!/usr/bin/env bash

PRIVATE_REGISTRY="docker.io/hkube"
DIR=$(realpath $(dirname $0))

echo $DIR
cd $DIR

./build.sh nodejs
./build.sh go
./build.sh python