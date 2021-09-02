docker rm -f gitea
docker run -d --name gitea -p 3010:3010 hkube/gitea-dev:v1.13.0-1