ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/algorithm-output/
WORKDIR /hkube/algorithm-output
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/algorithm-output
COPY --from=install /hkube/algorithm-output/node_modules /hkube/algorithm-output/node_modules
WORKDIR /hkube/algorithm-output
CMD ["node", "app.js"]