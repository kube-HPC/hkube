#!/bin/bash
set -ev

# install dvc and git
sudo curl https://dvc.org/deb/dvc.list -L --output /etc/apt/sources.list.d/dvc.list
sudo apt update && sudo apt install -y dvc
git config --global user.email "hkube@hkube.io" && git config --global user.name "hkube"

# run all the required containers
docker run -d --name etcd -p 2380:2380 -p 4001:4001 quay.io/coreos/etcd:latest /usr/local/bin/etcd \
  --data-dir=data.etcd --name "my-etcd" --cors='*' --initial-advertise-peer-urls http://0.0.0.0:2380 \
  --listen-peer-urls http://0.0.0.0:2380 --advertise-client-urls http://0.0.0.0:4001 \
  --listen-client-urls http://0.0.0.0:4001 --initial-cluster-state new
docker run -d -p 9000:9000 --name minio1 -e "MINIO_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE" \
  -e "MINIO_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" minio/minio server /data
docker run -d -p 27017:27017 --name mongodb -e MONGO_INITDB_ROOT_USERNAME=tester \
  -e MONGO_INITDB_ROOT_PASSWORD=password mongo:4.4.1-bionic
docker run -d -p 3010:3010 --name gitea hkube/gitea-dev:v1.13.0-1
