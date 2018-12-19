ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.1
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/resource-manager
RUN cd /hkube/resource-manager 
WORKDIR /hkube/resource-manager
CMD ["node", "app.js"]