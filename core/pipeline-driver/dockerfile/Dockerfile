FROM hkube/base-node:v1.0.0
LABEL maintainer="yehiyam@gmail.com"
RUN mkdir /hkube
COPY . /hkube/pipeline-driver
RUN cd /hkube/pipeline-driver 
WORKDIR /hkube/pipeline-driver
CMD ["node", "app.js"]