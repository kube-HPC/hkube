FROM node:8
MAINTAINER yehiyam@gmail.com
RUN apt update && apt install nano
RUN mkdir /sound-factory
COPY . /sound-factory/api-server
WORKDIR /sound-factory/api-server
CMD ["node", "app.js"]