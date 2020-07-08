ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/pipeline-driver
RUN cd /hkube/pipeline-driver 
WORKDIR /hkube/pipeline-driver
CMD ["node", "app.js"]
