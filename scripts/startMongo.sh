#!/bin/bash
docker rm -f mongodb
docker run -d --name mongodb \
      -p 27017:27017 \
      -e MONGO_INITDB_ROOT_USERNAME=tester \
      -e MONGO_INITDB_ROOT_PASSWORD=password mongo:4.4.1-bionic --replSet rs0

INIT=$(docker exec mongodb sh -c 'echo "rs.initiate().ok || rs.status().ok"|mongo -u tester -p password --quiet' | tr -d '\r')
COUNT=1
MAX_RETRY=10
while [ "$INIT" != "1" ]; do
  if [ "$COUNT" -gt "$MAX_RETRY" ]; then
    echo "Failed to initialize mongodb"
    exit 1
  fi
  echo "Waiting for mongo to be ready... ($COUNT/$MAX_RETRY)"
  sleep 1
  INIT=$(docker exec mongodb sh -c 'echo "rs.initiate().ok || rs.status().ok"|mongo -u tester -p password --quiet' | tr -d '\r')
  COUNT=$((COUNT+1))
done
echo "Mongo is ready!"