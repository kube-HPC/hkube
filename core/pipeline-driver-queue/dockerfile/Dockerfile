ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.1
LABEL maintainer="maty21@gmail.com"
RUN mkdir /hkube
COPY . /hkube/pipeline-driver-queue
RUN cd /hkube/pipeline-driver-queue
WORKDIR /hkube/pipeline-driver-queue
CMD ["node", "app.js"]
