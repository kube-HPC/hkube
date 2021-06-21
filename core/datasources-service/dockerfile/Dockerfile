ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}node:14.5.0 as install
ADD ./package-lock.json ./package.json /hkube/datasource-service/
WORKDIR /hkube/datasource-service
RUN npm ci --production
RUN echo stam

ARG BASE_PRIVATE_REGISTRY=""
FROM ${BASE_PRIVATE_REGISTRY}hkube/base-node:v1.2.1
LABEL maintainer="yehiyam@gmail.com"

RUN apt update && apt install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*
RUN wget -O dvc.deb https://github.com/iterative/dvc/releases/download/2.1.0/dvc_2.1.0_amd64.deb &&\
  apt install ./dvc.deb &&\
  rm ./dvc.deb
ADD dockerfile/gitconfig /.gitconfig
ADD dockerfile/gitconfig /root/.gitconfig
RUN mkdir -p /hkube/datasource-service
WORKDIR /hkube/datasource-service
COPY . /hkube/datasource-service
COPY --from=install /hkube/datasource-service/node_modules /hkube/datasource-service/node_modules
CMD ["node", "app"]
