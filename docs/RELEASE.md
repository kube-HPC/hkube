# Version Release
A frozen version in HKube is the combination of all services that match the `major.minor.*` semver.
## Release process
After a dev-version is tested and declared ready to release, the following process need to be executed:
1. Make sure that the `python` and `java` wrappers are release versions (check both in algorithm-builder service: [python](https://github.dev/kube-HPC/hkube/blob/master/core/algorithm-builder/environments/python/wrapper/requirements.txt), [java](https://github.dev/kube-HPC/hkube/blob/master/core/algorithm-builder/environments/java/wrapper/version.txt) and in artifacts-registry service: [python](https://github.dev/kube-HPC/artifacts-registry/blob/main/python-wrapper-version.txt), [java](https://github.dev/kube-HPC/artifacts-registry/blob/main/java-wrapper-version.txt))
2. Make note of the helm chart version to freeze. This will usually be the latest version.
3. If needed, promote the helm chart from dev-version to frozen version (from `./dev` to `./`). Run the [CI-PROMOTE](https://github.com/kube-HPC/helm/actions/workflows/promote.yaml) workflow specifing the chart version.
4. Run the [CI-CREATE_RELEASE_BRANCH](https://github.com/kube-HPC/release-manager/actions/workflows/release_branch.yaml) workflow to create a branch from all service versions, and to increment the minor/major versions in the `master` branch.
This workflow accepts the following inputs:
    1. `BRANCH`: The name of the branch to create. Naming convention is: `release_v$MAJOR.$MINOR`. (e.g. release_v_2.5)
    2. `VERSION`: The helm chart version (e.g. v2.5.121)
    3. `VERSION_TYPE`: The version type to increment in master. accepts `minor` or `major`. Defaults to `minor`

The workflow will:
* Download the helm chart
* Extract the release-manager tag (`fullSystemVersion`) and download the `version.json` file
* Clone [hkube](https://github.com/kube-HPC/hkube) and all other `hkube-core` repos.
* For each repo: 
    1. Checkout the appropriate `tag`
    2. Create a branch
    3. Push to upstream
    4. Checkout master/main
    5. Increment `minor`/`major` version
    6. Push to upstream
* Each push will trigger the repo's own build action to create a docker image for the new tag
Note: Currently there is a bug in the [hkube](https://github.com/kube-HPC/hkube) repo that fails the build. Run the [CI-MAIN](https://github.com/kube-HPC/hkube/actions/workflows/main.yaml) workflow manually with the `BUILD_ALL` flag set to true.

## Create Downloadable Bundle
Run the [CI-CREATE-RELEASE_BUNDLE_S3](https://github.dev/kube-HPC/release-manager/blob/master/.github/workflows/create_release_bundle_s3.yaml) workflow to create a downloadable bundle (tar.gz) that includes the chart, and all of the images.
The created tar.gz is uploaded to the `s3://downloads.hkube.io` bucket, and is available to download from `http://downloads.hkube.io/$VERSION` (e.g. http://downloads.hkube.io/v2.3.39/ for version v2.3.39)
