ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:18.1.0-buster as install
ADD ./package-lock.json ./package.json /hkube/datasource-service/
WORKDIR /hkube/datasource-service
RUN npm ci --production

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v2.0.1-buster
LABEL maintainer="yehiyam@gmail.com"
RUN apt update && apt install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN wget -O dvc.deb https://github.com/iterative/dvc/releases/download/2.9.3/dvc_2.9.3_amd64.deb &&\
  apt install ./dvc.deb &&\
  rm ./dvc.deb
ADD dockerfile/gitconfig /.gitconfig
ADD dockerfile/gitconfig /root/.gitconfig
RUN mkdir -p /hkube/datasource-service
WORKDIR /hkube/datasource-service
COPY . /hkube/datasource-service
COPY --from=install /hkube/datasource-service/node_modules /hkube/datasource-service/node_modules
CMD ["node", "app"]
