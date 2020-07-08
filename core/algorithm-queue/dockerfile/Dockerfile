ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="maty21@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-queue
RUN cd /hkube/algorithm-queue 
WORKDIR /hkube/algorithm-queue
CMD ["node", "app.js"]
