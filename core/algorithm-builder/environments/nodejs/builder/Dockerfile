
ARG BASE_PRIVATE_REGISTRY=""
ARG ALGORITHM_NAME

FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.1.0
LABEL maintainer="yehiyam@gmail.com"

RUN mkdir /hkube
COPY . /hkube/$ALGORITHM_NAME
RUN cd /hkube/${ALGORITHM_NAME}
WORKDIR /hkube/${ALGORITHM_NAME}
CMD ["npm", "start"]
