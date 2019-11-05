ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.1
LABEL maintainer="hkube.dev@gmail.com"

RUN apt update && apt install -y git gettext-base python3 python3-pip && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /hkube/algorithm-builder
WORKDIR /hkube/algorithm-builder
RUN mkdir -p /hkube/algorithm-builder/environments/python/packages
RUN pip3 download hkube-python-wrapper -d /hkube/algorithm-builder/environments/python/packages
COPY . /hkube/algorithm-builder
CMD ["npm", "start"]