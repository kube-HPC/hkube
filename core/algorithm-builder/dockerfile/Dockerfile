ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.0.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-builder
RUN cd /hkube/algorithm-builder
WORKDIR /hkube/algorithm-builder
CMD ["node", "app.js"]