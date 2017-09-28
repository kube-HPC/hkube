#!/bin/bash

echo Generating server key
openssl genrsa -out `pwd`/test/support/ssl/server.key 2048

echo Generating certificate signing request
openssl req -new -key `pwd`/test/support/ssl/server.key -out `pwd`/test/support/ssl/server.csr -config `pwd`/test/support/ssl/csr.config

echo Generating certificate from generated request
openssl x509 -req -in `pwd`/test/support/ssl/server.csr -signkey `pwd`/test/support/ssl/server.key -out `pwd`/test/support/ssl/server.cert -extfile `pwd`/test/support/ssl/csr.config -extensions v3_req

echo Generated certicate
echo
openssl x509 -in `pwd`/test/support/ssl/server.cert -noout -text
