#!/usr/bin/env bash

PRIVATE_REGISTRY="docker.io/hkube"
DIR=$(cd $(dirname ${BASH_SOURCE[0]}) && pwd)

echo $DIR

$DIR/build.sh nodejs
$DIR/build.sh go
$DIR/build.sh python