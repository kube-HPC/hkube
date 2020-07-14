#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/java/jars
export javaWrapperVersion='1.0-SNAPSHOT'
#docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=io.hkube:wrapper:$javaWrapperVersion:jar:wide -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/wrapper.jar
#docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=io.hkube:interfaces:$javaWrapperVersion:jar -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/interfaces.jar
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn -q dependency:get -Dartifact=io.hkube:java-algo-parent:$javaWrapperVersion:pom -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/java-algo-parent.xml