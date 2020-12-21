ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="reggev.am@gmail.com"
RUN mkdir /hkube
COPY . /hkube/datasource-service
RUN cd /hkube/datasource-service
WORKDIR /hkube/datasource-service
CMD ["node", "app.js"]
