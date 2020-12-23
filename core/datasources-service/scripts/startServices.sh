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

docker run -d -p 3010:3010 \
    --rm \
    --name gitea \
    hkube/gitea-dev:v1.13.0-0
