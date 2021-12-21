#!/bin/bash

# NOTE: the initial user HAS to be created on a primary node using localhost!
# mongo-0.mongo has a higher priority so it'll be the primary on initial boot

mongo <<EOF
   var cfg = {
        "_id": "rs",
        "version": 1,
        "members": [
            {
                "_id": 0,
                "host": "mongo-0.mongo:27017",
                "priority": 2
            },
            {
                "_id": 1,
                "host": "mongo-1.mongo:27017",
                "priority": 0
            },
            {
                "_id": 2,
                "host": "mongo-2.mongo:27017",
                "priority": 0
            }
        ]
    };
    rs.initiate(cfg, { force: true });
    //rs.reconfig(cfg, { force: true });
    rs.status();
EOF
echo "waiting 15 seconds for leader election..."
sleep 15

mongo <<EOF
    use admin;
    db.createUser({
        user: "admin",
        pwd: "password",
        roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
    });
EOF
mongo -u admin -p password <<EOF
    db.getSiblingDB('tests');
    use admin
    db.createUser({
        user: "tester",
        pwd: "password",
        roles: [ { role: "dbOwner", db: "tests" } ]
    });
EOF
