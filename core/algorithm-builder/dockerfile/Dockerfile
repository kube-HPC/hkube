ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/algorithm-builder/
WORKDIR /hkube/algorithm-builder
RUN npm ci --production
RUN echo stam

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="hkube.dev@gmail.com"

RUN set -eux; \
    sed -i 's|deb.debian.org/debian|archive.debian.org/debian|g' /etc/apt/sources.list; \
    sed -i 's|security.debian.org/debian-security|archive.debian.org/debian-security|g' /etc/apt/sources.list; \
    sed -i '/stretch-updates/d' /etc/apt/sources.list; \
    echo 'Acquire::Check-Valid-Until "false";' > /etc/apt/apt.conf.d/99no-check-valid-until; \
    apt-get update -o Acquire::AllowInsecureRepositories=true; \
    apt-get install -y --no-install-recommends git gettext-base; \
    rm -rf /var/lib/apt/lists/*

RUN apt update && apt install -y git gettext-base && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /hkube/algorithm-builder
WORKDIR /hkube/algorithm-builder
COPY . /hkube/algorithm-builder
COPY --from=install /hkube/algorithm-builder/node_modules /hkube/algorithm-builder/node_modules
CMD ["npm", "start"]