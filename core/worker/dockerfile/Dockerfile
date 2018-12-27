ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.1
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/worker
RUN cd /hkube/worker
WORKDIR /hkube/worker
CMD ["node", "app.js"]
