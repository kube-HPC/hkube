FROM node:8-alpine
LABEL maintainer="yehiyam@gmail.com"
RUN apk --update add nano && \
    rm -rf /var/cache/apk/*
RUN mkdir /hkube
COPY . /hkube/pipeline-driver
RUN cd /hkube/pipeline-driver && npm rebuild
WORKDIR /hkube/pipeline-driver
CMD ["node", "app.js"]