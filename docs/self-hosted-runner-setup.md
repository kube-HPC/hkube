# Reproduce Guide: Self-hosted EC2 runner for hkube `/deploy`

End-to-end, one-shot guide to recreate the self-hosted GitHub Actions runner that
runs the `deploy` job of `.github/workflows/deploy.yml`, in a **new environment**.
Includes every fine-tune/fix we hit the first time so it works first try.

> Access model: **SSM Session Manager only** (no inbound SSH). S3 is used to relay the
> kubeconfig from an existing cluster box to the runner. **No VPC endpoint** — bucket is
> secured with Block Public Access + least-privilege IAM.

---

## 0. Prerequisites / facts to gather

- Region (example here: `eu-west-1`).
- The VPC + a **public subnet** in it (runner goes here; masters are public).
- The **security group of the cluster masters** (to allow the runner in on 443).
- An existing instance that already has the working kubeconfig (single file with all
  cluster contexts, used via `kubectx`). In our case it was the kops box at
  `~/.kube/config`.
- Repo admin on `github.com/kube-HPC/hkube` (to register a runner + set variables).
- Context names inside the kubeconfig (ours): `dev1-spot.hkube.org`,
  `test-spot.hkube.org`, `cicd-spot.hkube.org`.

---

## 1. IAM role for the runner (SSM + S3 read)

Console: **IAM → Roles → Create role**
- Trusted entity: **AWS service → EC2**.
- Attach managed policy **`AmazonSSMManagedInstanceCore`** (enables SSM connect).
- Name: `hkube-self-hosted-ssm-role` → Create.

Then add an inline policy for reading the kubeconfig from S3:
**IAM → Roles → hkube-self-hosted-ssm-role → Add permissions → Create inline policy → JSON**:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::hkube-self-hosted/kube/*"
    }
  ]
}
```
Name: `hkube-self-hosted-read`.

---

## 2. Security group for the runner

Console: **EC2 → Security Groups → Create security group**
- Name: `hkube-runner-sg`, select the VPC.
- **Inbound rules: none** (SSM needs no inbound).
- **Outbound: leave default** `All traffic → 0.0.0.0/0` (needs GitHub, S3, cluster APIs).
- Create. Note its ID.

## 3. Allow the runner to reach the cluster masters

Console: **EC2 → Security Groups → (masters' SG) → Inbound rules → Edit**
- Add: Type **HTTPS `443`** (or your API port), **Source = `hkube-runner-sg`**.
- Save.

---

## 4. S3 bucket for the kubeconfig relay (BPA, no VPCe)

Console: **S3 → Create bucket**
- Name: `hkube-self-hosted`, your region.
- **Block all public access: ON** (leave checked).
- Create.

No bucket policy is required — access is governed purely by IAM (the source instance's
role for upload, the runner role for download) plus Block Public Access. Do **not** add
an `aws:sourceVpce` condition (that caused a console self-lockout last time).

> Optional hardening: add a bucket policy that denies any request where
> `aws:SecureTransport` is false (force TLS). Skip if you want the simplest setup.

---

## 5. Upload the kubeconfig from the existing cluster box

On the **source instance** (the one that already has the kubeconfig). Its role needs
`s3:PutObject` on `arn:aws:s3:::hkube-self-hosted/kube/*` (add temporarily if missing):
```bash
aws s3 cp ~/.kube/config s3://hkube-self-hosted/kube/config
```
This is a single kubeconfig containing all cluster contexts.

---

## 6. Launch the runner EC2 instance

Console: **EC2 → Instances → Launch instances**
- Name: `hkube-self-hosted`.
- AMI: **Ubuntu Server 22.04 LTS (x86_64)** (ships SSM agent preinstalled).
- Instance type: `t3.small` (or `t3.medium`).
- Key pair: **Proceed without a key pair** (we use SSM).
- Network → Edit:
  - VPC: your VPC.
  - Subnet: a **public or private subnet**.
  - Firewall: **Select existing** → `hkube-runner-sg`.
- Advanced details → **IAM instance profile**: `hkube-self-hosted-ssm-role`.
- Storage: `30 GiB gp3`.
- Launch.

(Optional) Allocate + associate an **Elastic IP** if the masters' API has an IP allow-list.

---

## 7. Connect via SSM and install tooling

**EC2 → Instances → hkube-self-hosted → Connect → Session Manager → Connect.**

You start as `ssm-user`; elevate to root for installs:
```bash
sudo -i
```

Install everything the deploy job needs:
```bash
apt-get update
apt-get install -y curl git gettext-base tar unzip

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
install -m 0755 kubectl /usr/local/bin/kubectl
kubectl version --client

# helm v3
curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash
helm version

# aws cli v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o awscliv2.zip
unzip -q awscliv2.zip
./aws/install
```

Verify the instance role works (no credentials needed — it uses the attached role):
```bash
aws sts get-caller-identity
# expect: arn:aws:sts::<acct>:assumed-role/hkube-self-hosted-ssm-role/i-xxxx
```

> Docker/Node are NOT needed here — `build_job` stays on GitHub-hosted runners; this box
> only runs `kubectl` + `helm`.

---

## 8. Create the dedicated runner user (FIX #1)

The GitHub runner refuses to configure/run as root. SSM logs you in as `ssm-user`, and
`sudo -i` makes you uid 0, so `./config.sh` fails with "Must not run with sudo" even
without typing sudo. Create a dedicated non-root user to own and run the runner:

```bash
# as root
useradd -m -s /bin/bash ghrunner
```

---

## 9. Place the kubeconfig with correct ownership (FIX #2)

Pull the kubeconfig down and give **ghrunner ownership of the whole directory** — not
just the file. `kubectl config use-context` writes a `config.lock` file *in the
directory*, so ghrunner must be able to create files there:

```bash
# as root
mkdir -p /etc/hkube/kube
aws s3 cp s3://hkube-self-hosted/kube/config /etc/hkube/kube/config

chown -R ghrunner:ghrunner /etc/hkube/kube
chmod 700 /etc/hkube/kube
chmod 600 /etc/hkube/kube/config
```

Verify as ghrunner (both read AND context-switch must work):
```bash
sudo -u ghrunner KUBECONFIG=/etc/hkube/kube/config kubectl config get-contexts
sudo -u ghrunner KUBECONFIG=/etc/hkube/kube/config kubectl config use-context cicd-spot.hkube.org
sudo -u ghrunner KUBECONFIG=/etc/hkube/kube/config kubectl cluster-info
```
`use-context` must print `Switched to context ...` with **no** `config.lock` permission
error. If you see that error, the directory (not just the file) isn't owned by ghrunner.

---

## 10. Download + register the GitHub runner (as ghrunner, no sudo)

Get a **fresh** registration token (expires ~1h):
**github.com/kube-HPC/hkube → Settings → Actions → Runners → New self-hosted runner**
(Linux / x64). Copy the download URL and the `--token` value.

Set up the runner directory owned by ghrunner:
```bash
# as root
mkdir -p /home/ghrunner/actions-runner
chown -R ghrunner:ghrunner /home/ghrunner/actions-runner
su - ghrunner
cd ~/actions-runner
```

As **ghrunner** (NO sudo):
```bash
curl -o actions-runner-linux-x64.tar.gz -L <download-url-from-github>
tar xzf actions-runner-linux-x64.tar.gz
./config.sh --url https://github.com/kube-HPC/hkube --token <fresh-token> --labels hkube-self-hosted
```
Press Enter through the prompts (runner group / name / work folder). Expect:
```
√ Runner successfully added
√ Settings Saved.
```
The label **`hkube-self-hosted`** is what `runs-on: [self-hosted, hkube-self-hosted]`
matches — keep it consistent with the workflow.

---

## 11. Install + start as a service running AS ghrunner (FIX #3)

`svc.sh` needs root, but must run the service as ghrunner (so jobs are non-root and can
read the kubeconfig). Exit back to root and pass the username:
```bash
exit                                   # back to root
cd /home/ghrunner/actions-runner
./svc.sh install ghrunner              # the 'ghrunner' arg = run service as that user
./svc.sh start
./svc.sh status                        # expect: active (running)
```
Confirm in **Settings → Actions → Runners**: runner shows green **Idle** with label
`hkube-self-hosted`.

---

## 12. Repo variables for the dashboard links

The deploy job reads `URL` from repo **variables** (non-sensitive; only used for the
deployment `environment_url` link).

**Settings → Secrets and variables → Actions → Variables tab → New variable**, add:
- `DEV1_URL` = dev1 dashboard hostname
- `TEST_URL` = test dashboard hostname
- `CICD_URL` = cicd dashboard hostname

(If you skip these, deploys still work; only the status link would be blank.)

---

## 13. The `deploy.yml` changes (only the `deploy` job)

`build_job` stays on `ubuntu-latest`. In the `deploy` job:

```yaml
  deploy:
    runs-on: [self-hosted, hkube-self-hosted]
    needs:
      - build_job
    name: deploy
    steps:
      - name: get environment
        run: |
          echo "running deploy.yml from ref: ${{ github.event.deployment.ref }}"
          echo "environment is: $DEPLOY_ENVIRONMENT"
          # single kubeconfig on the runner holds all cluster contexts; select via context
          case "$DEPLOY_ENVIRONMENT" in
            *dev1*)
              CONTEXT=dev1-spot.hkube.org
              URL=$DEV1_URL
              ;;
            *test*)
              CONTEXT=test-spot.hkube.org
              URL=$TEST_URL
              ;;
            *cicd*)
              CONTEXT=cicd-spot.hkube.org
              URL=$CICD_URL
              ;;
            *)
              echo "unknown environment. defaulting to cicd"
              CONTEXT=cicd-spot.hkube.org
              URL=$CICD_URL
              ;;
          esac
          echo "selected context: $CONTEXT"
          export KUBECONFIG=/etc/hkube/kube/config
          kubectl config use-context "$CONTEXT"
          echo KUBECONFIG=/etc/hkube/kube/config >> $GITHUB_ENV
          echo URL=$URL >> $GITHUB_ENV
        env:
          DEPLOY_ENVIRONMENT: "${{ github.event.deployment.environment }}"
          CICD_URL: ${{ vars.CICD_URL }}
          DEV1_URL: ${{ vars.DEV1_URL }}
          TEST_URL: ${{ vars.TEST_URL }}
      - name: download chart
        uses: actions/download-artifact@v4
        with:
          name: ${{ needs.build_job.outputs.chart }}
      - name: download values
        uses: actions/download-artifact@v4
        with:
          name: ${{ needs.build_job.outputs.values }}
      - name: verify kubectl
        run: kubectl cluster-info
      - name: deploy
        run: |
          helm ls
          helm upgrade -i hkube --wait --timeout 15m -f ${{ github.workspace }}/${{ needs.build_job.outputs.values }} ${{ github.workspace }}/${{ needs.build_job.outputs.chart }}
          helm ls
      # ...status steps unchanged...
```

Key points baked in:
- `runs-on: [self-hosted, hkube-self-hosted]` — routes to the runner.
- Cluster chosen by **context switch** on a single kubeconfig (kubectx style), not by
  decoding a per-env secret.
- `helm upgrade ... --timeout 15m` — tolerates ASG cold-start (nodes may be scaled to
  zero; without a longer timeout `--wait` can fail before a node is ready).
- `URL` from `vars.*` (dashboard link only).

---

## 14. Test end-to-end

1. Put the `deploy.yml` change on a branch, open a PR.
2. Comment `/deploy cicd` on the PR.
   - `createDeployment.yml` (from **master**, since it's `issue_comment`-triggered)
     creates a deployment with `ref` = your PR branch.
   - `deploy.yml` from **your branch** then runs on the self-hosted runner (the
     `deployment` event uses the deployed ref). The `echo "running deploy.yml from ref:"`
     line confirms which ref executed.
3. Watch logs in the Actions tab (self-hosted streams live, same as before).
4. Verify: runner picks up the job, switches to `cicd-spot.hkube.org`, `helm upgrade`
   succeeds, deployment status goes in_progress → success.
5. Repeat for `dev1` and `test`, then remove the old `*_KUBECONFIG` secrets.

---

## Gotchas checklist (the fixes, summarized)

- [ ] Runner user is **non-root** (`ghrunner`); `config.sh`/`run.sh` run WITHOUT sudo.
- [ ] `/etc/hkube/kube` **directory** owned by ghrunner (for `config.lock`), not just the file.
- [ ] Service installed with `./svc.sh install ghrunner` so it runs as ghrunner.
- [ ] Runner label matches workflow: `hkube-self-hosted`.
- [ ] Runner subnet is public with a public IP; masters' SG allows 443 from `hkube-runner-sg`.
- [ ] Instance role has SSM core + `s3:GetObject` on the bucket prefix; no keys configured.
- [ ] Repo variables `DEV1_URL` / `TEST_URL` / `CICD_URL` created.
- [ ] `helm upgrade` has `--timeout` for ASG scale-from-zero.
- [ ] Remove the temporary `echo "running deploy.yml from ref:"` after validation.
