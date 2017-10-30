FROM node:latest
MAINTAINER yehiyam@gmail.com

RUN mkdir /sound-factory && npm install -g nodemon
COPY . /sound-factory/pipeline-driver
WORKDIR /sound-factory/pipeline-driver
CMD ["nodemon", "app.js"]