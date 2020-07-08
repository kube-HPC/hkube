ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="maty21@gmail.com"
RUN mkdir /hkube
COPY . /hkube/trigger-service
RUN cd /hkube/trigger-service 
WORKDIR /hkube/trigger-service
CMD ["node", "app.js"]
