FROM node:latest
MAINTAINER yehiyam@gmail.com
RUN apt update && apt install nano
RUN mkdir /sound-factory && npm install -g nodemon
COPY . /sound-factory/api-server
WORKDIR /sound-factory/api-server
CMD ["nodemon", "app.js"]