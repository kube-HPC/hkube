ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:14.5.0 as install
ADD ./package-lock.json ./package.json /hkube/algorithm-builder/
WORKDIR /hkube/algorithm-builder
RUN npm ci --production
RUN echo stam

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="hkube.dev@gmail.com"

RUN apt update && apt install -y git gettext-base && rm -rf /var/lib/apt/lists/*
RUN mkdir -p /hkube/algorithm-builder
WORKDIR /hkube/algorithm-builder
COPY . /hkube/algorithm-builder
COPY --from=install /hkube/algorithm-builder/node_modules /hkube/algorithm-builder/node_modules
CMD ["npm", "start"]