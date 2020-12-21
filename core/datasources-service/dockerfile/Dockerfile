ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/api-server
RUN cd /hkube/api-server
WORKDIR /hkube/api-server
CMD ["node", "app.js"]