#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
export javaWrapperVersion='2.0-SNAPSHOT'
mkdir -p $SCRIPTPATH/../environments/java/debs
cd $SCRIPTPATH/../environments/java/debs
docker run --rm --workdir /tmp/pkg -v $SCRIPTPATH/../environments/java/debs:/tmp/pkg\
  adoptopenjdk/openjdk11:jre-11.0.8_10-ubuntu\
  bash -c 'apt-get update && apt-get download $(apt-cache depends --recurse --no-recommends --no-suggests  --no-conflicts --no-breaks --no-replaces --no-enhances  --no-pre-depends libzmq-java | grep "^\w")'
