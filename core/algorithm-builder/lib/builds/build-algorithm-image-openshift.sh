#!/usr/bin/env bash

# This script used to create a specific algorithm image
set -e
source $PWD/lib/builds/build-utils.sh

printEnvs
dockerBuildOpenshift
ret=${exit_code}
echo build finished with code $ret
echo

exit $ret
