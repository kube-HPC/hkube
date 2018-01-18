FROM hkube/base-node:v1.0.0
MAINTAINER yehiyam@gmail.com
RUN mkdir /hkube
COPY . /hkube/worker
RUN cd /hkube/worker
WORKDIR /hkube/worker
CMD ["node", "app.js"]
