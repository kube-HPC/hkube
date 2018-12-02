#!/usr/bin/env bash

PRIVATE_REGISTRY="docker.io/hkube"
./build.sh nodejs
./build.sh go
./build.sh python