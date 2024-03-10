ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/algorithm-debug/
WORKDIR /hkube/algorithm-debug
USER root
RUN chgrp -R 0 /hkube && chmod -R g=u /hkube
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
RUN mkdir -p /hkube-logs
USER root
RUN chgrp -R 0 /hkube && chmod -R g=u /hkube
RUN chgrp -R 0 /hkube-logs && chmod -R g=u /hkube-logs
COPY . /hkube/algorithm-debug
COPY --from=install /hkube/algorithm-debug/node_modules /hkube/algorithm-debug/node_modules
WORKDIR /hkube/algorithm-debug
CMD ["/bin/sh", "-c", "mkfifo /tmp/pipe; (tee -a /hkube-logs/stdout.log < /tmp/pipe & ) ; exec npm start > /tmp/pipe 2>&1"]