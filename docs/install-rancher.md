## Introduction
Some additional steps are needed to install HKube in a shared kubernetes environment (e.g. openshift, rancher)
The usual installation of kubernetes by openshift and rancher create a low privilege user. This user cannot get k8s resources
at the cluster scope, which creates the need to install HKube with different parameters
### install helm
If helm is already installed and configured in the cluster this step can be skipped
Ask your admin to:
1. create namespace for the tiller
2. create a service account, role and role-binding for the tiller, with access to your main namespace
```shell
export TILLER_NAMESPACE=tiller-hkube1
export TILLER_SA_NAME=tiller-hkube-sa
export TILLER_ROLE_NAME=tiller-hkube-role
export TILLER_ROLE_BINDING_NAME=tiller-hkube-role-binding
export HKUBE_NAMESPACE=hkube
```
```shell
sed -e "s/TILLER_ROLE_NAME/${TILLER_ROLE_NAME}/g" \
  -e "s/TILLER_ROLE_BINDING_NAME/${TILLER_ROLE_BINDING_NAME}/g" \
  -e "s/HKUBE_NAMESPACE/${HKUBE_NAMESPACE}/g" \
  -e "s/TILLER_NAMESPACE/${TILLER_NAMESPACE}/g" \
  -e "s/TILLER_SA_NAME/${TILLER_SA_NAME}/g" \
  docs/examples/role-tiller-template.yaml > /tmp/role-tiller.yaml
kubectl apply -f /tmp/role-tiller.yaml
```
3. install the tiller
```shell
helm --tiller-namespace=$TILLER_NAMESPACE --service-account=$TILLER_SA_NAME init
```
4. test your helm installation
```shell
helm --tiller-namespace=$TILLER_NAMESPACE version
```
### install hkube
Hkube requires a persistent storage solution. Currently S3 and file system are supported
1. For S3 either set the credentials and endpoint below, or start your own minio server
```shell
# set persistence.enabled=true to use persistent volumes
helm install --tiller-namespace=$TILLER_NAMESPACE --set accessKey=hkubeminiokey,secretKey=hkubeminiosecret,persistence.enabled=false \
   --name hkube-storage stable/minio
```


2. create a values.yaml file
```yaml
global:
  clusterName: cluster.local
  registry: ''
  registry_namespace: hkube
  registry_username: ''
  registry_password: ''
  storage:
    minio:
      access_key: hkubeminiokey
      secret_key: hkubeminiosecret
      url: 'http://hkube-storage-minio:9000'
  production: true
  ingress_controller_enable: false
  k8senv: k8s
  namespaced: true
  isPrivileged: false
ingress:
  hostname: ''
env:
  default_storage: s3
  node_env: production
build_secret:
  # pull secret is only needed if docker hub is not accessible
  pull:
    registry: ''
    namespace: ''
    username: ''
    password: ''
  # enter your docker hub / other registry credentials
  push:
    registry: '' # can be left empty for docker hub
    namespace: '' # registry namespace - usually your username
    username: ''
    password: ''
task_executor:
  env:
  # need to set the "size" of the cluster since hkube does not have the required permissions
    default_quota_cpu: 20
    default_quota_mem: 30Gi   
    pipeline_drivers_amount: 5 
```
3. add hkube helm chart repository
```shell
helm repo add hkube https://hkube.io/helm/
```
4. install
```shell
helm install --tiller-namespace=$TILLER_NAMESPACE --name hkube -f ./values.yaml hkube/hkube
```