ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:14.5.0 as install
ADD ./package-lock.json ./package.json /hkube/hkube-gc/
WORKDIR /hkube/hkube-gc
RUN npm ci --production


ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/hkube-gc
COPY --from=install /hkube/hkube-gc/node_modules /hkube/hkube-gc/node_modules
WORKDIR /hkube/hkube-gc
CMD ["node", "app.js"]