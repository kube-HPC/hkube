ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-node-runner
RUN cd /hkube/algorithm-node-runner
WORKDIR /hkube/algorithm-node-runner
CMD ["node", "app.js"]
