ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-runner-nodejs
RUN cd /hkube/algorithm-runner-nodejs
WORKDIR /hkube/algorithm-runner-nodejs
CMD ["node", "app.js"]
