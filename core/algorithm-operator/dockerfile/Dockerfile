ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.1
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-operator
RUN cd /hkube/algorithm-operator
WORKDIR /hkube/algorithm-operator
CMD ["node", "app.js"]