docker rm -f mongodb
docker run -d --name mongodb \
      -p 27017:27017 \
      -e MONGO_INITDB_ROOT_USERNAME=tester \
      -e MONGO_INITDB_ROOT_PASSWORD=password mongo:4.4.1-bionic