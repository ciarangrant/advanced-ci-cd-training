# Lab 7: Hackathon — Automated Pipeline Delivery

> **Scenario recap.** Your Deloitte delivery team owns an audit-evidence intake platform: three interdependent services — `nodejs-api`, `java-web`, `python-data` — each in its own code repo, all deployed from a central configuration repository that holds the Helm charts. Coordinating a release across the four repos is manual today, and the slow cycle time is the primary pain you are here to improve. Rollback decisioning reads a request-success-rate signal across the services — that is the secondary driver, taught in Module 6. You are working on one service's pipeline today; the Module 7 kickoff card gives the full frame.

> **Track posture for this README.** This workbench reference is **Local-Labs-primary**. All prose, code, acceptance criteria, and hints default to the Local Labs stack — K3s + Traefik + Gitea Actions + the pre-provisioned Prometheus/Grafana on your VM. Cloud Labs equivalents (GitHub Actions + AWS ALB/ECS/VPC) appear inside `::: cloud-lab` fences. Both tracks score identically against the same 100-point rubric. Use `terraform-local/` + `.gitea/workflows/` by default; if you are on Cloud Labs, swap to `terraform/` + `.github/workflows/` where the fence directs you.

> **Note:** This lab uses Podman as the container engine. Podman is a rootless, daemonless drop-in replacement for the Docker CLI. All Dockerfiles and container concepts from the slides apply — only the CLI command name differs.

> **Your lab URL:** Run `hostname` in your terminal. Your public URL is
> `<your-hostname>.labs.decoded.com`. Services are available on ports 5000–5005.

## Overview

You will build one delivery pipeline for one audit-evidence-intake service.

- **Service:** choose `nodejs-api`, `java-web`, or `python-data`.
- **Local Labs stack:** Podman, Terraform with the `hashicorp/kubernetes` provider, K3s, Traefik, Gitea Actions, Prometheus, and Grafana.
- **Pipeline path:** test, build, push image, provision blue/green resources, verify the success-rate signal, then shift traffic.
- **Output:** a repo, a deployed service accessible at `http://<hostname>.labs.decoded.com:5000` (nodejs-api), `:5001` (java-web), or `:5002` (python-data), a scored five-milestone deliverable, and an optional rollback job that returns traffic to blue when the SLO check fails.

### Target infrastructure by track

The pipeline architecture is the same; only the infrastructure targets differ (ported from the Module 07 deck's `::: local-lab` fence):

| Milestone | Cloud Labs | Local Labs |
|---|---|---|
| **M1: Containerise** | Podman multi-stage build | Identical |
| **M2: Infrastructure** | Terraform → AWS (ECS, ALB, VPC) | Terraform → K3s (Namespace, Deployment, Service, Traefik IngressRoute) |
| **M3: Pipeline** | GitHub Actions + GHCR | Gitea Actions + Gitea package registry (`localhost:8100`) |
| **M4: Deploy & verify** | ECS service + ALB weighted target groups | K3s Deployment + Traefik IngressRoute weighted services |
| **M5: Rollback** | ECS service update + ALB listener weight shift | `kubectl rollout undo` + Traefik weight shift via `terraform apply` |

### Time Budget

| Task | Estimated Time |
|------|---------------|
| Milestone 1: Containerise the application | 25 min |
| Milestone 2: Terraform infrastructure | 30 min |
| Milestone 3: CI/CD pipeline | 30 min |
| Milestone 4: Deployment strategy + health checks | 20 min |
| Milestone 5 (stretch): Automated rollback | 20 min |
| **Total working time** | **125 min** |

> The instructor kickoff is 10 min, followed by 125 min of working time (including the 20 min stretch), a 5 min checkpoint, and a 20 min show-and-tell debrief. Total session: 10 + 125 + 5 + 20 = 160 min.

## Objectives

- Build an end-to-end CI/CD pipeline that containerises an application, provisions infrastructure with Terraform, and deploys using a structured release strategy
- Configure automated health checks to verify deployment success
- Implement automated rollback when a deployment health check fails
- Apply CI/CD security best practices (pinned actions, least-privilege credentials, no hardcoded secrets)

## Prerequisites

- Your Local Labs VM, with Gitea, K3s, Traefik, Prometheus, and Grafana already provisioned (see `./scripts/check-lab-env.sh`)
- Gitea account (`lab-student` or your own) with repository creation permissions
- Git installed locally
- Podman installed locally (for building and testing images)
- Terraform 1.14+ installed locally (for validating configs)
- Completion of Modules 1-5 (or equivalent experience with Gitea/GitHub Actions, Docker, Terraform, K3s/ECS deployment strategies)

::: cloud-lab
**Cloud Labs prerequisites (in place of the Gitea/K3s stack above):**

- GitHub account with repository creation permissions
- AWS credentials with permissions to create VPCs, ALBs, ECS tasks or EC2 instances, and S3 buckets
:::

## Choose Your Application

Pick one of the three starter applications:

| Application | Directory | Stack | Build Command | Health Endpoint |
|---|---|---|---|---|
| **Node.js API** | `starter/nodejs-api/` | Express 4 + Node.js 20 | `npm ci && npm test` | `GET /health` → `{"status":"ok","uptime":...}` |
| **Java Web GUI** | `starter/java-web/` | Spring Boot 3.4 + Java 21 | `./mvnw test` | `GET /actuator/health` → `{"status":"UP"}` |
| **Python Data** | `starter/python-data/` | FastAPI + Python 3.12 | `pip install -r requirements.txt && pytest` | `GET /health` → `{"status":"healthy","uptime":...}` |

## Setup (summary)

> Your lab environment is pre-configured. If you encounter issues, ask your instructor.

In Gitea, create the `hackathon-pipeline` repo under your account, copy the starter files for your chosen app, and set `GITEA_USERNAME` + `GITEA_TOKEN` as repo secrets (the Gitea token must have `write:package` scope for the registry push in Milestone 3). If `./scripts/check-lab-env.sh` reports degraded mode, the Prometheus/Grafana stack is unavailable and you use the `curl /health` fallback documented in Hints 7 and 8.

::: cloud-lab
**Cloud Labs setup.** On the Cloud Labs track, replace the lab-scoped step above with: in GitHub, create the `hackathon-pipeline` repo, copy the starter files for your chosen app, set `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` as repo secrets, and set `AWS_REGION` + `ALB_DNS` as repo variables. Cloud Labs uses `terraform/` (not `terraform-local/`) and `.github/workflows/` (not `.gitea/workflows/`).
:::

### Your app's public hostname (by track)

On Local Labs, your app is exposed via a Traefik IngressRoute. There are two access modes:

- **Browser access (from your laptop):** use the public URL `<hostname>.labs.decoded.com:<port>`. Find your hostname with `hostname` in the terminal.
- **CLI / CI access (from the VM terminal or Gitea Actions runner):** use `http://<service>.local/...` — this resolves via VM CoreDNS + Traefik and is what the `verify` job uses.

| Application | Public browser URL | CLI / CI health URL |
|---|---|---|
| Node.js API | `http://<hostname>.labs.decoded.com:5000/health` | `http://nodejs-api.local/health` |
| Java Web GUI | `http://<hostname>.labs.decoded.com:5001/actuator/health` | `http://java-web.local/actuator/health` |
| Python Data | `http://<hostname>.labs.decoded.com:5002/health` | `http://python-data.local/health` |

The `verify` job in your Gitea Actions workflow uses the CLI / CI URLs (`<service>.local`) — no repo variable needed. Use the public browser URLs to open your deployed service in a browser during the show-and-tell demo.

::: cloud-lab
**Cloud Labs — ALB_DNS update.** Set `ALB_DNS` to `placeholder` in the repo variables initially. After your first `terraform apply` creates the ALB, copy the `alb_dns` output value (e.g., `hackathon-alb-123456.eu-west-1.elb.amazonaws.com`) and update the `ALB_DNS` variable in **Settings → Secrets and variables → Actions → Variables**. The `verify` job reads `${{ vars.ALB_DNS }}`; without a real value the health check has no target.
:::

## Poly-Repo Structure

> **This hackathon uses a poly-repo structure.** Your chosen service (`nodejs-api/`, `java-web/`, or `python-data/`) lives in its own repository — this is the repo you create as `hackathon-pipeline` in the Setup section. The shared infrastructure configuration (Terraform modules, Helm values, and the Prometheus PromQL expressions) lives in a separate `infra-config/` repository that the instructor has pre-seeded on your Gitea instance.
>
> You will actively push to both repos during the hackathon: your service repo gets the Dockerfile, application code, and the Gitea Actions workflow; `infra-config/` gets your Terraform changes when you customise the blue/green weights or add a new variable. This mirrors real microservice delivery at Deloitte clients, where each team owns their service repo while platform configuration (Helm charts, Terraform root modules, PromQL alert rules) is centralised in a platform-owned config repo.
>
> **Practical implication:** when you run `git push` to trigger your pipeline, confirm you are in the correct repo directory. The most common early mistake is running `terraform apply` from the service repo instead of the `infra-config/` directory.

## Environment Preamble

The install and check scripts verify the observability layer your Milestone 4 and 5 jobs consume. You do not install Prometheus, author PromQL, or stand up Grafana. Module 6 walks through the same artefacts as the teaching counterpart to this preamble. The PromQL expression and the `verify`-job query step are identical across tracks — only the endpoint URLs and the CI-runner syntax differ.

**Endpoints available at lab open (Local Labs):**

- `PROMETHEUS_URL` — base URL for the pre-installed Prometheus 2.53.0 LTS server on the VM. Canonical value: `http://localhost:8101` (Prometheus is accessed by the Gitea Actions runner over the VM's localhost; no public port is exposed). Set as a repository variable in Gitea Actions.
- `GRAFANA_DASHBOARD_URL` — link to the pre-authored Grafana 10.4.0 LTS dashboard. In your browser: `http://<hostname>.labs.decoded.com:8102` (replace `<hostname>` with the output of `hostname`). Internally on the VM: `http://localhost:8102`. Shows the success-rate expression per service across all three apps.
- `/metrics` routes are already live behind Traefik at `http://nodejs-api.local/metrics`, `http://java-web.local/actuator/prometheus`, and `http://python-data.local/metrics` (accessed by the Prometheus scraper running on the VM — CLI context only; these hostnames resolve via CoreDNS + Traefik on the VM). The instrumentation libraries (`prom-client`, `micrometer-registry-prometheus`, `prometheus-fastapi-instrumentator`) are wired into the starter code.

**Pre-authored PromQL success-rate expression** (on disk at `promql/success-rate.promql`):

```promql
sum(rate(http_requests_total{job=~"nodejs-api|java-web|python-data",status=~"2.."}[5m]))
/
sum(rate(http_requests_total{job=~"nodejs-api|java-web|python-data"}[5m]))
```

Read: successful-request rate divided by total-request rate, across the three services, over the 5-minute rollback window. Your **SLO threshold** is `0.95` — the pipeline gates on this value.

**Pre-provided PromQL query step — Gitea Actions fragment** (already present in `.gitea/workflows/deploy.yml`):

```yaml
- name: PromQL query step — evaluate success-rate expression
  id: success_rate
  run: |
    VALUE=$(curl -sG "$PROMETHEUS_URL/api/v1/query" \
      --data-urlencode "query=$(cat promql/success-rate.promql)" \
      | jq -r '.data.result[0].value[1]')
    echo "value=$VALUE" >> "$GITHUB_OUTPUT"
    awk -v v="$VALUE" -v t="$SLO_THRESHOLD" 'BEGIN { exit (v+0 < t+0) }'
  env:
    PROMETHEUS_URL: ${{ vars.PROMETHEUS_URL }}
    SLO_THRESHOLD: "0.95"
```

> Gitea Actions re-uses GitHub Actions YAML syntax (including `$GITHUB_OUTPUT`) — this fragment runs identically on either runner.

**Plain shell alternative** (for pipelines that prefer a shell block instead of the YAML fragment):

```bash
VALUE=$(curl -sG "$PROMETHEUS_URL/api/v1/query" \
  --data-urlencode "query=$(cat promql/success-rate.promql)" \
  | jq -r '.data.result[0].value[1]')
awk -v v="$VALUE" -v t="0.95" 'BEGIN { exit (v+0 < t+0) }'
```

Milestone 4 wires the Gitea Actions fragment into the `verify` job. Milestone 5 uses the non-zero exit code as the `if: failure()` trigger for the `rollback` job.

> **Fallback.** If the install or check scripts report degraded mode at lab open, the Prometheus + Grafana stack is unavailable for this run. Milestones 4 and 5 retain the `curl http://<service>.local/health` path shown in the starter workflow (Hint 7 and Hint 8 below); the Module 6 walkthrough is conceptual only.

::: cloud-lab
**Cloud Labs Environment Preamble variant.** On the Cloud Labs track the endpoints point into your AWS environment: `PROMETHEUS_URL` is the AWS-hosted Prometheus (e.g. the Amazon Managed Service for Prometheus workspace URL, or a Prometheus running on an EC2 instance inside your VPC), `GRAFANA_DASHBOARD_URL` is the matching Amazon Managed Grafana workspace, and `/metrics` is fronted by the ALB. Paste the PromQL fragment above into `.github/workflows/deploy.yml` (not `.gitea/workflows/deploy.yml`) and read `${{ vars.PROMETHEUS_URL }}` from GitHub repo variables.

Degraded-mode fallback on Cloud Labs uses the ALB hostname instead of `<service>.local`:

```bash
curl -s -o /dev/null -w "%{http_code}" http://${{ vars.ALB_DNS }}/health
```
:::

## Milestone 1: Containerise the Application (20 points)

**Task:** Complete the Dockerfile and verify the container runs with a healthy status.

### Tasks

1. Open the `Dockerfile` in your starter directory. For Node.js and Java, the build stage is partially complete — add the missing runtime stage. For Python, the Dockerfile uses a single-stage build (no compiled artifacts to separate) — add the runtime configuration.

2. Requirements for the runtime stage (or runtime configuration for Python):
   - Use a minimal base image:
     - Node.js: `node:20-alpine`
     - Java: `eclipse-temurin:21-jre-alpine`
     - Python: `python:3.12-slim`
   - Copy only the runtime artifacts from the build stage (no source code, no dev dependencies)
   - Set `EXPOSE` to the correct port (Node `3000`, Java `8080`, Python `8000`)
   - Add a `HEALTHCHECK` instruction that tests the health endpoint
   - Set the `CMD` to start the application

3. Build and test locally:

```bash
podman build -t hackathon-app .
podman run -d -p 3000:3000 --name hackathon-test hackathon-app  # Adjust port for your stack
```

4. Verify health:

```bash
# Wait for the container to become healthy
podman ps  # Should show (healthy) after the start period
curl http://localhost:3000/health  # Should return 200 with JSON body
```

5. Push the image to the Gitea package registry at `localhost:8100` (for Milestone 3's pipeline to pull):

```bash
podman login localhost:8100  # Use your Gitea username + a Gitea personal access token with write:package scope
podman tag hackathon-app localhost:8100/<your-gitea-user>/nodejs-api:dev
podman push localhost:8100/<your-gitea-user>/nodejs-api:dev
```

> **Registry port note.** The live Local Labs VM exposes Gitea and its package registry at **port 8100**. Use **`localhost:8100`** in your code.

### Acceptance Criteria

- [ ] Dockerfile uses a multi-stage build (Node.js, Java) or a single-stage build with minimal base image (Python)
- [ ] Runtime image uses a minimal base image (Alpine or slim variant)
- [ ] `HEALTHCHECK` instruction is present with appropriate `--interval`, `--timeout`, `--start-period`, and `--retries`
- [ ] `podman ps` shows the container as `(healthy)`
- [ ] `curl` to the health endpoint returns HTTP 200
- [ ] Image pushed to the Gitea package registry at `localhost:8100/<user>/<app>:<tag>`

::: cloud-lab
**Cloud Labs Acceptance Criteria (swap for the two bullets above that mention `localhost:8100`):**

- [ ] Image pushed to GitHub Container Registry at `ghcr.io/<owner>/<app>:<tag>` (the `build-and-push` job in `.github/workflows/deploy.yml` drives this in Milestone 3; the local push is optional dry-run muscle-memory)
:::

### Scoring

| Criterion | Points |
|---|---|
| Multi-stage Dockerfile (Node.js/Java) or single-stage with best practices (Python) | 5 |
| Minimal base image in runtime stage | 5 |
| HEALTHCHECK instruction with correct endpoint and timing | 5 |
| Container runs and passes health check locally | 5 |
| **Subtotal** | **20** |

<details><summary>Hint 1 — Local Labs: Node.js runtime stage</summary>

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/src ./src
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1
CMD ["node", "src/index.js"]
```

> **Note:** Alpine images include `wget` but not `curl`. Use `wget --spider` for health checks, or add `RUN apk add --no-cache curl` before the HEALTHCHECK if you prefer `curl`. The app listens on port **3000** (see `starter/nodejs-api/src/index.js`).

</details>

<details><summary>Hint 2 — Local Labs: Java runtime stage</summary>

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
RUN apk add --no-cache curl
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8080/actuator/health || exit 1
CMD ["java", "-jar", "app.jar"]
```

</details>

<details><summary>Hint 3 — Local Labs: Python runtime configuration</summary>

The Python starter uses a single-stage build (Python does not produce compiled artifacts that benefit from multi-stage separation). Add the runtime configuration after the `COPY src ./src` line:

```dockerfile
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

</details>

::: cloud-lab
<details><summary>Hint 1c — Cloud Labs: registry push variant</summary>

On Cloud Labs, the image push is handled by the `build-and-push` job in `.github/workflows/deploy.yml`, not by you interactively. If you want to rehearse locally (optional), point podman at GHCR:

```bash
echo "$GHCR_PAT" | podman login ghcr.io -u <gh-user> --password-stdin
podman tag hackathon-app ghcr.io/<gh-owner>/nodejs-api:dev
podman push ghcr.io/<gh-owner>/nodejs-api:dev
```

The Dockerfile itself (Hints 1-3) is identical across tracks — only the registry destination differs.

</details>
:::

---

## Milestone 2: Terraform Infrastructure (25 points)

**Task:** Complete the Terraform configuration to provision the infrastructure your application needs.

On Local Labs you are provisioning **K3s resources** using the `hashicorp/kubernetes` provider — a Namespace, two Deployments (blue + green), two Services (blue + green), and a Traefik IngressRoute with weighted backends. Module 3 used the `kreuzwerker/docker` provider to manage individual containers; for the hackathon you use `hashicorp/kubernetes` instead, which gives you the same deployment patterns (blue/green, health checks, traffic splitting) that the Cloud Labs track achieves with AWS ECS + ALB. The starter scaffolds the provider block and all variables for you (see `terraform-local/main.tf` L1-44) — your job is to add the five `TODO` resources at L46-60.

### Tasks

1. Open the `terraform-local/` directory. The `hashicorp/kubernetes` provider block, the `project_name` / `gitea_user` / `image_tag` / `app_port` / `blue_weight` / `green_weight` variables, and the resource TODO skeletons are scaffolded. Add the missing resources.

2. Required resources:
   - A `kubernetes_namespace` for `var.project_name` (the namespace name resolves to `nodejs-api`, `java-web`, or `python-data` depending on which app you chose — never a literal `hackathon`).
   - A `kubernetes_deployment` named `blue` with 2 replicas, image `localhost:8100/${var.gitea_user}/${var.project_name}:${var.image_tag}`, containerPort `var.app_port`, and a liveness probe on the app's health endpoint.
   - A `kubernetes_deployment` named `green` (identical shape, different label selector).
   - A `kubernetes_service` for each of blue and green.
   - A `kubernetes_manifest` for a Traefik `IngressRoute` CRD with a `Host(${var.project_name}.local)` match and two weighted `services` entries keyed to `var.blue_weight` and `var.green_weight`.

3. Open `terraform-local/outputs.tf` (create if absent). Add a `namespace_name` output so teardown can read it back: `output "namespace_name" { value = kubernetes_namespace.app.metadata[0].name }`.

4. Validate:

```bash
cd terraform-local
terraform init
terraform validate
terraform plan -var="gitea_user=<your-gitea-user>" -var="image_tag=dev"
```

::: cloud-lab
**Cloud Labs task variant.** On the Cloud Labs track you provision AWS resources in `terraform/` instead: an ALB (Application Load Balancer) with two target groups (blue and green), a listener rule with weighted forwarding based on `traffic_distribution`, a CloudWatch log group for ECS task logs, an IAM execution role for ECS tasks (`AmazonECSTaskExecutionRolePolicy`), and a compute target (ECS cluster, Fargate task definition with `execution_role_arn`, and service). Also complete `terraform/outputs.tf` so `alb_dns` references `aws_lb.app.dns_name`, and configure the S3 remote backend (uncomment `backend "s3"` and replace `REPLACE_ME_UNIQUE_SUFFIX`). Validate with `cd terraform && terraform init && terraform validate && terraform plan -var="image_tag=test"`.
:::

### Acceptance Criteria

- [ ] `terraform validate` passes with no errors in `terraform-local/`
- [ ] `terraform plan` shows the five expected resources (Namespace, two Deployments, two Services, one IngressRoute) without errors
- [ ] The `blue_weight` / `green_weight` variables control the IngressRoute's service weights
- [ ] Variables are parameterised (`project_name`, `gitea_user`, `image_tag`, `app_port`, `blue_weight`, `green_weight` — none hardcoded)
- [ ] `namespace_name` output is defined in `outputs.tf` (required for the teardown script)

::: cloud-lab
**Cloud Labs Acceptance Criteria (replace the four Local-Labs bullets above):**

- [ ] `terraform validate` passes with no errors in `terraform/`
- [ ] `terraform plan` shows ALB, two target groups, listener rule, CloudWatch log group, ECS cluster/task/service without errors
- [ ] The `traffic_distribution` variable controls ALB listener weights
- [ ] Variables are parameterised (region, instance type, image tag are not hardcoded)
- [ ] Remote backend is configured with S3
:::

### Scoring

| Criterion | Points |
|---|---|
| K3s resource set (Namespace, blue/green Deployments, blue/green Services) on Local Labs **or** ALB + ECS resource set on Cloud Labs | 5 |
| Two weighted backends (blue/green Services behind IngressRoute on Local; two target groups on Cloud) | 8 |
| Weighted traffic routing via `var.blue_weight`/`var.green_weight` (Local) or listener rule weights (Cloud) | 7 |
| Remote or equivalent state management (S3 backend on Cloud; local state on Local with `outputs.tf` complete) | 3 |
| Variables parameterised (no hardcoded values) | 2 |
| **Subtotal** | **25** |

<details><summary>Hint 4 — Local Labs: Traefik IngressRoute with weighted backends</summary>

```hcl
resource "kubernetes_manifest" "ingressroute" {
  manifest = {
    apiVersion = "traefik.io/v1alpha1"
    kind       = "IngressRoute"
    metadata = {
      name      = "${var.project_name}-route"
      namespace = kubernetes_namespace.app.metadata[0].name
    }
    spec = {
      entryPoints = ["web"]
      routes = [{
        match = "Host(`${var.project_name}.local`)"
        kind  = "Rule"
        services = [
          {
            name   = kubernetes_service.blue.metadata[0].name
            port   = var.app_port
            weight = var.blue_weight
          },
          {
            name   = kubernetes_service.green.metadata[0].name
            port   = var.app_port
            weight = var.green_weight
          },
        ]
      }]
    }
  }
}
```

The `Host()` match locks the public hostname to `<service>.local` (e.g. `nodejs-api.local`). The two weighted `services` entries give you the same blue/green traffic-split control that AWS ALB listener rules provide — flip `var.blue_weight`/`var.green_weight` from `100/0` to `50/50` to `0/100` via `terraform apply -var=...` to shift traffic.

</details>

<details><summary>Hint 5 — Local Labs: blue/green weight variables</summary>

The starter already scaffolds these (see `terraform-local/main.tf` L36-44):

```hcl
variable "blue_weight" {
  type    = number
  default = 100
}

variable "green_weight" {
  type    = number
  default = 0
}
```

Typical flow:

- Initial apply: `blue_weight=100 green_weight=0` (all traffic to blue)
- Post-verify shift: `blue_weight=0 green_weight=100` (all traffic to green)
- Rollback (M5): `blue_weight=100 green_weight=0` (back to blue)

Unlike AWS ALB's discrete `traffic_distribution = "blue" | "split" | "green"` map, the Traefik IngressRoute's `weight` attribute is numeric — you can shift to any split you want (e.g. `80/20` for canary).

</details>

::: cloud-lab
<details><summary>Hint 4c — Cloud Labs: ALB listener with weighted target groups</summary>

```hcl
resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "forward"
    forward {
      target_group {
        arn    = aws_lb_target_group.blue.arn
        weight = var.traffic_weights[var.traffic_distribution].blue
      }
      target_group {
        arn    = aws_lb_target_group.green.arn
        weight = var.traffic_weights[var.traffic_distribution].green
      }
    }
  }
}
```

</details>

<details><summary>Hint 5c — Cloud Labs: traffic weight variable</summary>

```hcl
variable "traffic_distribution" {
  type    = string
  default = "blue"
}

variable "traffic_weights" {
  type = map(object({
    blue  = number
    green = number
  }))
  default = {
    blue  = { blue = 100, green = 0 }
    split = { blue = 50,  green = 50 }
    green = { blue = 0,   green = 100 }
  }
}
```

</details>
:::

---

## Milestone 3: CI/CD Pipeline (25 points)

**Task:** Create a Gitea Actions workflow that builds, pushes, provisions, and deploys.

The Local Labs pipeline flow (ported from the Module 07 deck):

```
Git Push -> Gitea Actions
  ├── Test (npm/mvn/pytest)
  ├── Build & Push Image -> Gitea Registry (localhost:8100)
  ├── Terraform Plan (on PR)
  ├── Terraform Apply (on merge) -> K3s resources
  ├── Health Check (curl http://<app>.local/health)
  ├── Traffic Shift (update Traefik weights via terraform apply)
  └── Rollback (revert weights on failure)
```

### Tasks

1. Open `.gitea/workflows/deploy.yml`. The workflow structure is provided with placeholder TODO steps (see starter file).

2. Complete the following jobs:
   - **test:** Run lint and tests for your application
   - **build-and-push:** Build the Docker image with `docker/build-push-action` and push to the Gitea package registry at `localhost:8100`
   - **terraform-plan / terraform-apply:** Run `terraform -chdir=terraform-local plan` on pull requests, `terraform apply` on push to main
   - **verify:** Poll `http://<service>.local/health` until it returns 200 (or invoke the PromQL query step from the Environment Preamble — this is Milestone 4)

3. Requirements:
   - Pin all actions to commit SHAs (not version tags)
   - Configure dependency caching (`cache: npm` / `cache: maven` / `cache: pip`)
   - Use `${{ secrets.GITEA_USERNAME }}` + `${{ secrets.GITEA_TOKEN }}` for registry auth; never hardcoded
   - Tag Docker images with `${{ gitea.sha }}`
   - Terraform steps pass `-var="image_tag=${{ gitea.sha }}" -var="gitea_user=${{ gitea.actor }}"`

4. Push and verify the workflow triggers. Gitea Actions UI is at `http://<hostname>.labs.decoded.com:8100/<your-user>/hackathon-pipeline/actions` (replace `<hostname>` with the output of `hostname`; from the VM terminal: `http://localhost:8100/<your-user>/hackathon-pipeline/actions`).

### Acceptance Criteria

- [ ] Workflow triggers on push to `main` and on PRs to `main`
- [ ] Test job runs lint and tests with dependency caching
- [ ] Build job creates and pushes a Docker image to `localhost:8100` tagged with the commit SHA
- [ ] Terraform job runs `plan` on PR, `apply` on merge, against `terraform-local/`
- [ ] All actions are pinned to commit SHAs
- [ ] Gitea credentials are injected via `${{ secrets.GITEA_USERNAME }}` + `${{ secrets.GITEA_TOKEN }}`, never hardcoded

::: cloud-lab
**Cloud Labs Acceptance Criteria (replace the three Local-Labs bullets above):**

- [ ] Build job creates and pushes a Docker image to **GHCR** (`ghcr.io/<owner>/<app>:<sha>`) tagged with the commit SHA
- [ ] Terraform job runs `plan` on PR, `apply` on merge, against `terraform/` (AWS backend)
- [ ] AWS credentials are injected via `${{ secrets.AWS_ACCESS_KEY_ID }}` + `${{ secrets.AWS_SECRET_ACCESS_KEY }}`, never hardcoded; workflow has `permissions: contents: read, packages: write`
:::

### Scoring

| Criterion | Points |
|---|---|
| Workflow triggers correctly on push and PR | 3 |
| Test job with caching | 5 |
| Docker build + push to Gitea registry (Local) / GHCR (Cloud) with SHA tag | 7 |
| Terraform plan/apply with conditional logic | 7 |
| Actions pinned to SHAs + credentials via secrets | 3 |
| **Subtotal** | **25** |

<details><summary>Hint 6 — Local Labs: Conditional Terraform job (Gitea Actions)</summary>

```yaml
  terraform-plan:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555e7e3f22b67044a7
        with:
          terraform_version: 1.14.8
      - run: terraform init
        working-directory: ./terraform-local
      - run: terraform plan -var="image_tag=${{ gitea.sha }}" -var="gitea_user=${{ gitea.actor }}"
        working-directory: ./terraform-local

  terraform-apply:
    needs: build-and-push
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555e7e3f22b67044a7
        with:
          terraform_version: 1.14.8
      - run: terraform init
        working-directory: ./terraform-local
      - run: |
          terraform apply -auto-approve \
            -var="image_tag=${{ gitea.sha }}" \
            -var="gitea_user=${{ gitea.actor }}" \
            -var="blue_weight=100" \
            -var="green_weight=0"
        working-directory: ./terraform-local
```

> **No AWS creds needed.** The Gitea runner on your VM inherits `~/.kube/config` from the `lab-student` home directory, which already points at the local K3s cluster. Gitea Actions re-uses GitHub Actions YAML; `gitea.sha` / `gitea.actor` / `gitea.ref_name` replace `github.sha` etc.
>
> **Traffic flow:** `terraform-apply` deploys the new image with `blue_weight=100 green_weight=0` (traffic stays on blue). After the `verify` job confirms the green environment is healthy, a `shift-traffic` job applies `blue_weight=0 green_weight=100` to route users to the new version.

</details>

::: cloud-lab
<details><summary>Hint 6c — Cloud Labs: Conditional Terraform job (GitHub Actions)</summary>

```yaml
  terraform-plan:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555e7e3f22b67044a7
        with:
          terraform_version: 1.14.8
      - run: terraform init
        working-directory: ./terraform
      - run: terraform plan -var="image_tag=${{ github.sha }}"
        working-directory: ./terraform
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}

  terraform-apply:
    needs: build-and-push
    if: github.event_name == 'push'
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555e7e3f22b67044a7
        with:
          terraform_version: 1.14.8
      - run: terraform init
        working-directory: ./terraform
      - run: terraform apply -auto-approve -var="image_tag=${{ github.sha }}" -var="traffic_distribution=blue"
        working-directory: ./terraform
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
```

</details>
:::

---

## Milestone 4: Deployment Strategy + Health Checks (20 points)

**Task:** Deploy with traffic shifting and verify the success-rate expression is at or above the SLO threshold before routing users to the new version.

### Tasks

1. Add a `verify` job to the workflow that runs after the Terraform apply.

2. The verify job should:
   - Wait 30 seconds for the new deployment to register with Traefik and for Prometheus to complete at least one scrape cycle.
   - Invoke the pre-provided **PromQL query step** against the pre-authored **success-rate expression** at `promql/success-rate.promql` (see the Environment Preamble above). Use either the Gitea Actions fragment or the shell-script alternative.
   - Exit 0 when the expression is at or above the **SLO threshold** (`0.95`) across the **rollback window** (5 minutes). Exit 1 otherwise.

3. Add a `shift-traffic` job that runs after `verify` passes. This job runs `terraform apply` with `blue_weight=0 green_weight=100` to route all traffic to the new version. The sequence is: `terraform-apply` (deploys with `blue_weight=100 green_weight=0`) → `verify` (PromQL query step) → `shift-traffic` (flips weights to `0/100`).

### Acceptance Criteria

- [ ] Verify job invokes the PromQL query step against the pre-authored success-rate expression
- [ ] Verify passes when the expression is at or above the SLO threshold across the rollback window
- [ ] Traffic shifts to 100% green (via `blue_weight=0 green_weight=100`) only after verification passes
- [ ] The blue environment's Deployment + Service remain in place for rollback

::: cloud-lab
**Cloud Labs Acceptance Criteria (replace the two weight-variable bullets above):**

- [ ] Traffic shifts to 100% green (via `traffic_distribution=green`) only after verification passes
- [ ] Both blue and green target groups remain healthy and attached to the ALB for rollback
:::

### Scoring

| Criterion | Points |
|---|---|
| PromQL success-rate query step replaces inline health check; verify job returns success if success-rate is at or above the SLO threshold (fallback `curl /health` path acceptable under degraded mode) | 8 |
| Traffic shift conditional on health pass | 7 |
| Both blue and green environments remain active | 5 |
| **Subtotal** | **20** |

<details><summary>Hint 7 — Local Labs: Health check with retry loop</summary>

```yaml
  verify:
    needs: terraform-apply
    runs-on: ubuntu-24.04
    steps:
      - name: Wait for Traefik to register the new Service
        run: sleep 30
      - name: Health check with retries
        run: |
          # Hostname is hardcoded per starter — <service>.local resolves via
          # VM CoreDNS + the Traefik IngressRoute Host() match in terraform-local/main.tf.
          # Use nodejs-api.local, java-web.local, or python-data.local based on your app.
          HOST="nodejs-api.local"  # adjust per chosen app; java-web uses /actuator/health
          PATH_="/health"
          for i in $(seq 1 10); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${HOST}${PATH_}")
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed on attempt $i"
              exit 0
            fi
            echo "Attempt $i: status $STATUS, retrying in 10s..."
            sleep 10
          done
          echo "Health check failed after 10 attempts"
          exit 1
```

No `ALB_DNS` variable — the stable hostname is resolved by K3s + CoreDNS + Traefik IngressRoute, fixed by `Host(${var.project_name}.local)` in `terraform-local/main.tf`.

</details>

::: cloud-lab
<details><summary>Hint 7c — Cloud Labs: Health check with retry loop (ALB)</summary>

```yaml
  verify:
    needs: terraform-apply
    runs-on: ubuntu-24.04
    steps:
      - name: Wait for registration
        run: sleep 30
      - name: Health check with retries
        run: |
          for i in $(seq 1 10); do
            STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://${{ vars.ALB_DNS }}/health)
            if [ "$STATUS" = "200" ]; then
              echo "Health check passed on attempt $i"
              exit 0
            fi
            echo "Attempt $i: status $STATUS, retrying in 10s..."
            sleep 10
          done
          echo "Health check failed after 10 attempts"
          exit 1
```

</details>
:::

---

## Milestone 5 (Stretch): Automated Rollback (10 points)

**Task:** When the success-rate expression drops below the SLO threshold across the rollback window, automatically roll back traffic to the blue environment.

### Tasks

1. Add a `rollback` job that runs only when the `verify` job fails — that is, when the PromQL query step exits non-zero because the success-rate expression is below the SLO threshold across the rollback window.

2. The rollback job should:
   - Run `terraform apply` with `blue_weight=100 green_weight=0` (Local Labs) to shift Traefik weights back to blue.
   - Invoke the PromQL query step again against the blue environment to confirm the success-rate expression has returned to at or above the SLO threshold.

### Acceptance Criteria

- [ ] Rollback job uses `if: failure()` to trigger when the PromQL query step returns a non-zero exit code (success-rate below SLO threshold across the rollback window)
- [ ] Rollback applies `blue_weight=100 green_weight=0` via `terraform apply` against `terraform-local/`
- [ ] A post-rollback invocation of the PromQL query step confirms the blue environment is above the SLO threshold

::: cloud-lab
**Cloud Labs Acceptance Criteria (replace the middle bullet):**

- [ ] Rollback applies `traffic_distribution=blue` via `terraform apply` against `terraform/` (AWS ALB listener weights)
:::

### Scoring

| Criterion | Points |
|---|---|
| Rollback job triggers on verify failure (`if: failure()`) | 4 |
| Terraform apply with blue-only weights (Local: `blue_weight=100 green_weight=0`; Cloud: `traffic_distribution=blue`) | 3 |
| Post-rollback health verification | 3 |
| **Subtotal** | **10** |

<details><summary>Hint 8 — Local Labs: Rollback job (Gitea Actions)</summary>

```yaml
  rollback:
    needs: verify
    if: failure()
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555e7e3f22b67044a7
        with:
          terraform_version: 1.14.8
      - run: terraform init
        working-directory: ./terraform-local
      - run: |
          terraform apply -auto-approve \
            -var="image_tag=${{ gitea.sha }}" \
            -var="gitea_user=${{ gitea.actor }}" \
            -var="blue_weight=100" \
            -var="green_weight=0"
        working-directory: ./terraform-local
      - name: Verify rollback
        run: |
          sleep 15
          HOST="nodejs-api.local"  # adjust per chosen app
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${HOST}/health")
          if [ "$STATUS" = "200" ]; then
            echo "Rollback verified - blue environment healthy"
          else
            echo "WARNING: Rollback health check returned $STATUS - manual intervention required"
            exit 1
          fi
```

No AWS creds; the Gitea runner uses the local `~/.kube/config` and talks directly to the K3s API. The Traefik IngressRoute picks up the new weights immediately — rollback is effectively instant.

</details>

::: cloud-lab
<details><summary>Hint 8c — Cloud Labs: Rollback job (GitHub Actions)</summary>

```yaml
  rollback:
    needs: verify
    if: failure()
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
      - uses: hashicorp/setup-terraform@b9cd54a3c349d3f38e8881555e7e3f22b67044a7
        with:
          terraform_version: 1.14.8
      - run: terraform init
        working-directory: ./terraform
      - run: terraform apply -auto-approve -var="image_tag=${{ github.sha }}" -var="traffic_distribution=blue"
        working-directory: ./terraform
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      - name: Verify rollback
        run: |
          sleep 15
          STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://${{ vars.ALB_DNS }}/health)
          if [ "$STATUS" = "200" ]; then
            echo "Rollback verified - blue environment healthy"
          else
            echo "WARNING: Rollback health check returned $STATUS - manual intervention required"
            exit 1
          fi
```

</details>
:::

---

## Fallback Track

If you are behind schedule at the 90-minute mark, switch to this reduced scope:

1. Complete the Dockerfile with HEALTHCHECK (Milestone 1)
2. Use the provided Terraform configuration in `terraform-local/` without modification (skip adding the five resource blocks)
3. Complete the Gitea Actions workflow for build and `terraform plan` only (no apply, no deploy)

This produces a working CI pipeline that builds a container and validates infrastructure.

## Scoring Summary

| Milestone | Points | Core/Stretch |
|---|---|---|
| 1 — Containerisation | 20 | Core |
| 2 — Terraform infrastructure | 25 | Core |
| 3 — CI/CD pipeline | 25 | Core |
| 4 — Deployment + health checks | 20 | Core |
| 5 — Automated rollback | 10 | Stretch |
| **Total** | **100** | |

**70+ points** = Successful completion (all core milestones partially complete)
**90+ points** = Stretch goal achieved

## Pre-Ship OWASP CI/CD Checklist

Use this checklist (drawn from the OWASP CI/CD Security Cheat Sheet, cheatsheetseries.owasp.org) to audit your pipeline before the show-and-tell. It maps to the OWASP Top 10 CI/CD Security Risks. Most items are track-neutral — security principles apply regardless of whether you are on Gitea + K3s or GitHub + AWS.

- [ ] **Flow control.** PRs require review before merge to `main` (branch protection rule or repo policy).
- [ ] **Dependency integrity.** Actions are pinned to commit SHAs, not mutable tags (`actions/checkout@<sha>` not `@v4`). Lockfiles committed: `package-lock.json` / `pom.xml` / `requirements.txt`.
- [ ] **Pipeline execution.** Secrets are never echoed or logged. Masking is the default but the `echo "$SECRET"` anti-pattern defeats it.
- [ ] **Credential hygiene.** No hardcoded credentials in code, Dockerfiles, or Terraform configs. Secrets live in the CI secret store and surface as env vars only at step scope.
- [ ] **System configuration.** Runner OS version pinned (`ubuntu-24.04`, not `ubuntu-latest`) so a runner-image update cannot silently change your build environment.
- [ ] **Artifact integrity.** Container images tagged with the commit SHA for traceability, not only `:latest` or `:dev`.
- [ ] **Logging.** Pipeline logs capture stage outcomes (pass/fail, durations, PromQL values) without exposing secret values.
- [ ] **Access management (Local Labs).** Gitea account permissions scoped per repo; the `GITEA_TOKEN` secret uses `write:package` scope only — not an admin PAT. K3s RBAC restricts the deploy step's kubeconfig context to the service's namespace (`var.project_name`).

::: cloud-lab
**Access management (Cloud Labs).** Pipeline credentials use least-privilege AWS IAM (Identity and Access Management) policies — the deploy role can update the ECS service and ALB listener for this stack only, not the whole account. No `AdministratorAccess`; scope down to the specific ECS cluster, ALB, and target groups by ARN.
:::

> Self-audit: tick each box before the show-and-tell. Any unchecked box is a known-gap item you should call out during your debrief — "I know I used `ubuntu-latest`; here is what I would change to harden this for production."

## Troubleshooting Guide

Common failure modes you may hit during the hackathon, with cause and fix. Most tables are Local-Labs-primary (Gitea, K3s, Traefik); Cloud Labs equivalents appear inside `::: cloud-lab` fences. Docker/Podman behaviour is track-neutral.

### Docker / Podman build failures

| Symptom | Likely Cause | Fix |
|---|---|---|
| `COPY failed: file not found` | Wrong path in `COPY` instruction | Check the build context (`.`) and relative paths |
| `npm ci` fails in build stage | Missing `package-lock.json` | Run `npm install` locally first to generate the lockfile |
| Container starts but health check fails | Wrong port in `EXPOSE` or `HEALTHCHECK` | Verify the app listens on the port specified in the health check (Node.js app = 3000, Java = 8080, Python = 8000) |
| `exec format error` | Built on ARM (Apple Silicon), running on x86 | Use `podman build --platform linux/amd64` |

### Terraform failures (Local Labs — `terraform-local/`)

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Error: Unauthorized` from `kubernetes_*` resource | K3s kubeconfig missing or wrong context | Check `~/.kube/config` exists and `kubectl get nodes` returns the VM's K3s node |
| `Error: Error acquiring the state lock` | Previous `terraform apply` did not release the lock | Wait 60 seconds; if the lock persists, use Terraform's force-release command with the lock ID from the error |
| Traefik `IngressRoute` not matching — 404 from Traefik | Host rule mismatch or CRD not installed | Verify `Host()` match in `main.tf` is `<service>.local` (your `var.project_name`.local); confirm CRD: `kubectl get crd ingressroutes.traefik.io` |
| Provider version mismatch | `.terraform.lock.hcl` not committed | Commit the lockfile and run `terraform init` |
| `terraform plan` shows unexpected deletions | State drift from `kubectl` changes | Run `terraform refresh` first, then review the plan |

::: cloud-lab
### Terraform failures (Cloud Labs — `terraform/`)

| Symptom | Likely Cause | Fix |
|---|---|---|
| `Error: No valid credential sources found` | AWS credentials not set | Check `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in GitHub secrets |
| `Error: Error acquiring the state lock` | Previous run did not release the lock | Wait 60 seconds; if the lock persists, use Terraform's force-release command with the lock ID from the error |
| `terraform plan` shows unexpected deletions | State drift from manual changes in the AWS console | Run `terraform refresh` first, then review the plan |
| Provider version mismatch | `.terraform.lock.hcl` not committed | Commit the lockfile and run `terraform init` |
:::

### Gitea Actions failures (Local Labs — `.gitea/workflows/`)

| Symptom | Likely Cause | Fix |
|---|---|---|
| Workflow does not trigger | File not in `.gitea/workflows/` or runner not registered | Verify directory name and YAML extension; check runner health in Gitea **Site Administration → Actions → Runners** |
| `unauthorized: authentication required` pushing to `localhost:8100` | Missing or mis-scoped `GITEA_TOKEN` | Regenerate the token with `write:package` scope and update the repo secret; login step must use `${{ gitea.actor }}` / `${{ secrets.GITEA_TOKEN }}` |
| Secret value is empty in the job | Secret name mismatch or wrong scope | Check exact name in **Repo Settings → Actions → Secrets** matches `${{ secrets.NAME }}` |
| `terraform` command not found | Missing `setup-terraform` step | Add the `hashicorp/setup-terraform` action before Terraform commands |
| `${{ gitea.repository }}` expands unexpectedly | Gitea uses `gitea.*` not `github.*` context | Swap `github.` prefixes for `gitea.` in the workflow (e.g., `gitea.actor`, `gitea.repository`, `gitea.sha`) |

::: cloud-lab
### GitHub Actions failures (Cloud Labs — `.github/workflows/`)

| Symptom | Likely Cause | Fix |
|---|---|---|
| Workflow does not trigger | File not in `.github/workflows/` | Verify directory name and YAML file extension |
| `Permission denied` on GHCR push | Missing `packages: write` permission | Add `permissions: packages: write` to the workflow or job |
| Secret value is empty in the job | Secret name mismatch or wrong scope | Check exact name in **Settings → Secrets and variables → Actions** matches `${{ secrets.NAME }}` |
| `terraform` command not found | Missing `setup-terraform` step | Add the `hashicorp/setup-terraform` action before Terraform commands |
:::

### Deployment and health-check failures (Local Labs — Traefik + K3s)

| Symptom | Likely Cause | Fix |
|---|---|---|
| Traefik returns 502 Bad Gateway | Service has no ready pods behind it | `kubectl get pods -n <var.project_name>` — check `READY` column and pod `describe` events |
| Traefik returns 503 Service Unavailable | `IngressRoute` references a Service that does not exist, or weights sum to 0 | Verify both `blue` and `Service` names in `IngressRoute` `spec.routes[].services[]` match actual Services; check `blue_weight + green_weight > 0` |
| `Host()` match fails — request hits default Traefik response | Hostname typo or DNS not resolving `<service>.local` | Verify `curl -H 'Host: nodejs-api.local' http://<vm-ip>/health` works; check CoreDNS config on the VM |
| Canary weight never shifts | `blue_weight`/`green_weight` variables not re-applied | Pass variables explicitly: `terraform apply -var='blue_weight=0' -var='green_weight=100'` |
| Rollback job does not trigger | Missing `if: failure()` condition on the `rollback` job | Add `if: failure()` referencing the `verify` job, and ensure the PromQL step uses `exit 1` on sub-threshold |

::: cloud-lab
### Deployment and health-check failures (Cloud Labs — ALB + ECS)

| Symptom | Likely Cause | Fix |
|---|---|---|
| ALB returns 502 Bad Gateway | Target group has no healthy targets | Check that the container is running and registered with the target group |
| Health check times out | Security group blocks the health check port | Verify inbound rules allow traffic on the app port from the ALB |
| Canary traffic never shifts | `traffic_distribution` variable not updated | Pass the variable in `terraform apply -var='traffic_distribution=green'` |
| Rollback job does not trigger | Missing `if: failure()` condition | Add `if: failure()` to the rollback job |
:::

## Recap & Takeaways

- You built and pushed a container image for one service.
- You provisioned K3s resources with Terraform: Namespace, blue/green Deployments, Services, and a Traefik IngressRoute.
- You wired a Gitea Actions workflow from `test` through `terraform apply` and `verify`.
- You gated traffic shift on the PromQL success-rate expression.
- If you reached Milestone 5, your rollback job reapplied `blue_weight=100 green_weight=0` when the SLO check failed.

::: cloud-lab
**Cloud Labs recap.** On Cloud Labs the same learning arc lands on AWS primitives: the container image pushes to GHCR, the Terraform stack creates an ALB with two target groups, the GitHub Actions workflow drives `terraform apply` with `traffic_distribution=blue`, `verify` hits `http://${{ vars.ALB_DNS }}/` via the ALB, and rollback applies `traffic_distribution=blue` against the ALB listener. Concept parity, different tooling surface.
:::

## Teardown

On the Local Labs VM, your hackathon resources are namespaced per service (namespace name = `var.project_name`, resolves to `nodejs-api` / `java-web` / `python-data`). Tear them down via Terraform (preferred — matches how you provisioned them):

```bash
cd terraform-local
terraform destroy -auto-approve \
  -var="gitea_user=<your-gitea-user>" \
  -var="image_tag=dev"
```

Or use `kubectl` directly if Terraform state is lost:

```bash
# Reads the namespace name from the outputs.tf block you added in Milestone 2.
kubectl delete namespace $(terraform -chdir=terraform-local output -raw namespace_name)
# Or, if you know which app you ran (namespace = var.project_name default):
kubectl delete namespace nodejs-api    # or java-web, or python-data
```

Then remove the local container and image from Milestone 1 and the Gitea registry tag:

```bash
podman stop hackathon-test
podman rm hackathon-test
podman rmi hackathon-app
podman rmi localhost:8100/<your-gitea-user>/nodejs-api:dev  # optional — frees Gitea disk
```

::: cloud-lab
**Cloud Labs teardown.** Skipping teardown leaves a live ALB, ECS task, VPC, and S3 state bucket accruing AWS charges — this is the most expensive lab in the programme if left running. Destroy your stack:

```bash
cd terraform
terraform destroy -auto-approve
```

Then the local-container cleanup above is the same on both tracks.
:::

> Repo cleanup (optionally delete the `hackathon-pipeline` Gitea repo, or the GHCR package on Cloud Labs) is handled by the instructor at end-of-cohort.
