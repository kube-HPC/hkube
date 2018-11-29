ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-${ALGORITHM_LANG}:v1.0.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube

COPY . /hkube/api-server
RUN cd /hkube/api-server
WORKDIR /hkube/api-server
CMD ["node", "app.js"]
