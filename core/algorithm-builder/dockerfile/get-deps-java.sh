#!/bin/bash
set -eo pipefail
SCRIPTPATH="$( cd "$(dirname "$0")" ; pwd -P )"
mkdir -p $SCRIPTPATH/../environments/java/jars
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn dependency:get -Dartifact=io.hkube:wrapper:1.0-SNAPSHOT:jar:wide -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/wrapper.jar
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn dependency:get -Dartifact=io.hkube:interfaces:1.0-SNAPSHOT:jar -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/interfaces.jar
docker run --rm  -v $SCRIPTPATH/../environments/java/jars:/jars maven mvn dependency:get -Dartifact=io.hkube:java-algo-parent:1.0-SNAPSHOT:pom -DremoteRepositories=https://oss.sonatype.org/content/repositories/snapshots -Ddest=/jars/java-algo-parent.xml