#!/usr/bin/env bash

docker rm -f etcd etcd-ui
docker run -d --name etcd -p 4001:4001 -p 2380:2380 gcr.io/etcd-development/etcd:v3.4.13 /usr/local/bin/etcd --data-dir=data.etcd --logger=zap --log-level=debug --name "my-etcd" --cors='*' --initial-advertise-peer-urls http://0.0.0.0:2380 --listen-peer-urls http://0.0.0.0:2380 --advertise-client-urls http://0.0.0.0:4001 --listen-client-urls http://0.0.0.0:4001 --initial-cluster-state new --max-wals 4
docker run -d --name etcd-ui -p 8080:8080 hkube/etcd-ui:v2.0.2

