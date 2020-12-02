docker run -d --name etcd \
    --rm \
    -p 2380:2380 \
    -p 4001:4001 \
    quay.io/coreos/etcd:latest /usr/local/bin/etcd \
    --data-dir=data.etcd \
    --name "my-etcd" \
    --cors='*' \
    --initial-advertise-peer-urls http://0.0.0.0:2380 \
    --listen-peer-urls http://0.0.0.0:2380 \
    --advertise-client-urls http://0.0.0.0:4001 \
    --listen-client-urls http://0.0.0.0:4001 \
    --initial-cluster-state new

docker run -d -p 9000:9000 \
    --rm \
    --name minio \
    -e "MINIO_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE" \
    -e "MINIO_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" \
    minio/minio server /data

docker run -d -p 27017:27017 \
    --rm \
    --name mongodb \
    mongo:4.4.1-bionic

docker run \
    -d \
    --rm \
    -p 6379:6379 \
    --name redis \
    redis
