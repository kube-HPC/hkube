ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="maty21@gmail.com"
RUN mkdir /hkube
COPY . /hkube/caching-service
RUN cd /hkube/caching-service
WORKDIR /hkube/caching-service
CMD ["node", "app.js"]