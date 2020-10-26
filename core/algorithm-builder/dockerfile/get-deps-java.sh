#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/java/jars
mkdir -p $SCRIPTPATH/../environments/java/m2
export javaWrapperVersion='1.0-SNAPSHOT'
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=io.hkube:wrapper:$javaWrapperVersion:jar:wide -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/wrapper.jar
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=io.hkube:interfaces:$javaWrapperVersion:jar -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/interfaces.jar
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=io.hkube:java-algo-parent:$javaWrapperVersion:pom -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/java-algo-parent.xml
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=io.hkube:algorithm-deployment-descriptor:$javaWrapperVersion:jar -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/algorithm-deployment-descriptor.jar
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=org.apache.maven.plugins:maven-assembly-plugin:2.5.3:jar -Ddest=/jars/maven-assembly-plugin.jar
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=org.json:json:20190722:jar -Ddest=/jars/json.jar


mkdir -p $SCRIPTPATH/../environments/java/debs
cd $SCRIPTPATH/../environments/java/debs
docker run --rm --workdir /tmp/pkg -v $SCRIPTPATH/../environments/java/debs:/tmp/pkg\
  adoptopenjdk/openjdk11:jre-11.0.8_10-ubuntu\
  bash -c 'apt-get update && apt-get download $(apt-cache depends --recurse --no-recommends --no-suggests  --no-conflicts --no-breaks --no-replaces --no-enhances  --no-pre-depends libzmq-java | grep "^\w")'
