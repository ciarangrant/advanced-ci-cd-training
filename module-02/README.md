# Lab 2: Docker Multi-Stage Builds & Vulnerability Scanning

> **Note:** This lab uses Podman as the container engine. Podman is a rootless, daemonless drop-in replacement for the Docker CLI. All Dockerfiles and container concepts from the slides apply — only the CLI command name differs.

> **Track posture for this README.** This workbench reference is **Local-Labs-primary**, but the Docker/Podman/Trivy content in Tasks 1-4 is **track-neutral** — it runs identically on the Local Labs VM and on the Cloud Labs laptop because both tracks use Podman for container operations. The only track-divergent step is the final **Pushing to a Registry** section: Local Labs pushes to the Gitea package registry at `localhost:8100`, Cloud Labs pushes to GHCR at `ghcr.io`. Cloud Labs equivalents appear in `::: cloud-lab` fences where needed.

## Overview

This lab takes the same Node.js service from Lab 1 and packages it into a hardened production container image. You start with a naive single-stage Dockerfile, then refactor to a multi-stage build that separates build-time dependencies from the runtime image, then scan the final image for HIGH and CRITICAL CVEs with Trivy and generate an SBOM in SPDX JSON. By the end you will have a `my-app:multi` image under 200 MB, a `sbom.json` describing every package in it, and a clean Trivy scan report. This lab exercises the multi-stage build pattern, `.dockerignore` layer-cache discipline, and image-scan CI gating covered in Module 2 — giving you the container artefact that the Module 3 Terraform stack and the Module 7 hackathon pipeline both consume.

### Time Budget

| Task | Estimated Time |
|------|---------------|
| Setup and orientation | 3 min |
| Task 1: Single-stage Dockerfile with Alpine | 7 min |
| Task 2: Refactor to multi-stage build | 8 min |
| Task 3: Trivy vulnerability scan | 6 min |
| Task 4: Verify container runs correctly | 4 min |
| Review and teardown | 2 min |
| **Total** | **30 min** |

## Objectives

- Write a multi-stage Dockerfile that separates build and production stages
- Minimise image size using Alpine base images, .dockerignore, and instruction ordering
- Scan the final image for vulnerabilities using Trivy
- Verify the containerised application runs and responds correctly

## Prerequisites

- Podman installed (v4+ recommended; run `podman --version` to check)
- Trivy installed (run `trivy --version` to check; see Appendix E.8 for manual install steps if needed)
- Node.js 20 installed (for local testing before containerisation)
- A text editor
- Completed Module 1 (familiarity with Gitea / GitHub Actions workflows, caching, and SHA-pinning)

## Setup (summary)

> Your lab environment is pre-configured. If you encounter issues, ask your instructor.

`cd` into `<course-repo>/labs/module-02/starter` and confirm the starter app boots locally: `npm install && npm start`, hit `curl http://localhost:3000/health`, `Ctrl+C`. (The starter app listens on port **3000** — see `src/index.js` L4. Port 8100 is the Gitea package registry, not the app.)

## Task 1: Single-stage Dockerfile with Alpine base

Create a `.dockerignore` file and a single-stage `Dockerfile` in the `<course-repo>/labs/module-02/starter/` directory.

### .dockerignore

Create a `.dockerignore` file that excludes at least:

- `node_modules`
- `.git`
- `dist`
- `*.md`
- `.env`

### Dockerfile requirements

- Use `node:20-alpine` as the base image
- Set the working directory to `/app`
- Copy dependency manifests (`package.json`, `package-lock.json`) before application source
- Install production dependencies with `npm ci --omit=dev`
- Copy the `src/` directory
- Expose port 3000
- Use exec form for CMD: `CMD ["node", "src/index.js"]`

### Verify

```bash
podman build -t my-app:single .
podman images my-app:single
```

The image size should be under 200 MB.

<details><summary>Hint 1: .dockerignore syntax</summary>

The `.dockerignore` file uses the same syntax as `.gitignore`. One pattern per line:

```
node_modules
.git
dist
*.md
.env
```

</details>

<details><summary>Hint 2: Instruction ordering</summary>

Copy the dependency files first, install, then copy source:

```dockerfile
COPY package.json package-lock.json .
RUN npm ci --omit=dev
COPY src/ ./src/
```

This order ensures `npm ci` is cached when only source files change.

</details>

## Task 2: Refactor to multi-stage build

Replace your single-stage Dockerfile with a multi-stage Dockerfile.

### Requirements

- **Stage 1 (builder):** Install all dependencies (including devDependencies), copy source, run `npm run build` to compile into `dist/`
- **Stage 2 (production):** Install production dependencies only, copy the compiled `dist/` directory from the builder stage using `COPY --from=builder`
- Name stages using `AS builder` and `AS production`
- The production stage CMD should run `node dist/index.js`

### Verify

```bash
podman build -t my-app:multi .
podman images my-app
```

Compare the `single` and `multi` image sizes. The multi-stage image should be smaller (no devDependencies).

<details><summary>Hint 3: COPY --from syntax</summary>

```dockerfile
COPY --from=builder /app/dist ./dist
```

This copies only the compiled output from the builder stage into the production stage.

</details>

<details><summary>Hint 4: Two-stage structure</summary>

```dockerfile
FROM node:20-alpine AS builder
# ... install all deps, build ...

FROM node:20-alpine AS production
# ... install prod deps only, copy dist from builder ...
```

</details>

## Task 3: Trivy vulnerability scan

Scan your multi-stage image for HIGH and CRITICAL vulnerabilities.

### Requirements

- Run Trivy against the `my-app:multi` image
- Filter for HIGH and CRITICAL severity
- Use `--exit-code 1` so the scan fails if vulnerabilities are found
- Generate an SBOM (Software Bill of Materials) in SPDX JSON format

### Commands

```bash
# Scan with severity filter
trivy image --severity HIGH,CRITICAL --exit-code 1 my-app:multi

# Generate SBOM
trivy image --format spdx-json --output sbom.json my-app:multi
```

### Verify

- If the scan passes (exit code 0), your image has no HIGH/CRITICAL CVEs
- If it fails (exit code 1), read the output table to identify which packages have vulnerabilities, then update those dependencies in `package.json` and rebuild
- Confirm that `sbom.json` was created and contains package information

<details><summary>Hint 5: Interpreting Trivy output</summary>

Trivy output splits into sections:

- **OS packages** (e.g., Alpine `apk` packages) -- fix by updating the base image
- **Application dependencies** (e.g., npm packages) -- fix by updating `package.json`

If a CVE has status "fixed", an updated version is available. Run `npm audit fix` or update the specific package.

</details>

## Task 4: Verify container runs correctly

Run the container and confirm it responds on port 3000.

### Requirements

- Run the `my-app:multi` image, mapping container port 3000 to host port 3000
- Verify the `/health` endpoint returns `{"status":"ok"}`
- Verify the `/api/info` endpoint returns a JSON response
- Stop and remove the container

### Commands

```bash
# Run in detached mode
podman run -d --name my-app-test -p 3000:3000 my-app:multi

# Test endpoints (app listens on port 3000; 8100 is the Gitea registry)
curl http://localhost:3000/health
curl http://localhost:3000/api/info

# View logs
podman logs my-app-test

# Stop and remove
podman stop my-app-test
podman rm my-app-test
```

<details><summary>Hint 6: Container not responding?</summary>

Common issues:

- **Port mapping:** Ensure `-p 3000:3000` maps host port to container port
- **CMD issue:** If using shell form (`CMD node ...`), the process may not receive signals correctly. Use exec form (`CMD ["node", ...]`)
- **Missing dist/:** If the build step failed silently, `dist/index.js` may not exist. Check build logs by re-running `podman build`

</details>

## Acceptance Criteria

- [ ] `.dockerignore` file exists and excludes `node_modules`, `.git`, `dist`, `*.md`, and `.env`
- [ ] Dockerfile uses `node:20-alpine` as the base image (not `node:20` or `node:latest`)
- [ ] Dockerfile uses multi-stage build with at least two stages (builder and production)
- [ ] Builder stage runs `npm run build` to produce compiled output in `dist/`
- [ ] Production stage uses `COPY --from=builder` to copy only the `dist/` directory
- [ ] Production stage installs only production dependencies (`npm ci --omit=dev`)
- [ ] Final image size is under 200 MB (`podman images my-app:multi`)
- [ ] Trivy scan runs with `--severity HIGH,CRITICAL --exit-code 1`
- [ ] SBOM file (`sbom.json`) is generated in SPDX JSON format
- [ ] Container runs and `/health` endpoint returns `{"status":"ok"}`
- [ ] Container runs and `/api/info` endpoint returns valid JSON

## Recap & Takeaways

You produced a multi-stage `Dockerfile` that splits build-time tooling from the runtime image, a `.dockerignore` that keeps `node_modules` and `.git` out of the build context, a Trivy-clean `my-app:multi` image under 200 MB, and an SPDX-JSON SBOM for supply-chain visibility. You practised the Module 2 patterns explicitly: instruction ordering for layer-cache hits, Alpine-minimal base images, `COPY --from=<stage>` for artefact promotion, and CI-friendly scan flags (`--severity HIGH,CRITICAL --exit-code 1`). That exact image shape and scan gate is what the Module 7 hackathon pipeline builds and pushes to the Gitea package registry (Local Labs) or GHCR (Cloud Labs).

- You have a multi-stage image artefact under 200 MB that passes a HIGH/CRITICAL Trivy scan.
- You generated `sbom.json` as the supply-chain record for the image.
- You know how to read a Trivy report and tell OS-package CVEs apart from application-dependency CVEs.

## Pushing to a Registry

Your Module 7 hackathon pipeline will need the image in a registry the CI runner can pull from. On Local Labs this is the Gitea package registry running at `localhost:8100` on your VM; log in with your Gitea username and a Gitea personal access token with `write:package` scope, then tag and push:

```bash
podman login localhost:8100  # Gitea username + PAT with write:package scope
podman tag my-app:multi localhost:8100/<your-gitea-user>/my-app:v1.0
podman push localhost:8100/<your-gitea-user>/my-app:v1.0
```

After the push, confirm the image is listed in the Gitea UI at `http://<hostname>.labs.decoded.com:8100/<your-gitea-user>/-/packages` (replace `<hostname>` with the output of `hostname`).

::: cloud-lab
**Cloud Labs: push to GHCR instead.** Use GitHub Container Registry as your registry URL, and a GitHub personal access token with `write:packages` scope:

```bash
echo "$GHCR_PAT" | podman login ghcr.io -u <your-gh-user> --password-stdin
podman tag my-app:multi ghcr.io/<your-gh-owner>/my-app:v1.0
podman push ghcr.io/<your-gh-owner>/my-app:v1.0
```

The image tagging structure (`<registry>/<owner>/<image>:<tag>`) and the `podman login`/`tag`/`push` commands are identical across tracks — only the registry host and the token scope name differ.
:::

## Teardown

Run the operating-tool teardown so the `my-app-test` container and the `my-app:single` / `my-app:multi` images do not confuse a later lab if you reuse names:

```bash
# Stop and remove any running containers
podman stop my-app-test 2>/dev/null; podman rm my-app-test 2>/dev/null

# Remove built images
podman rmi my-app:single my-app:multi 2>/dev/null

# Remove SBOM file
rm -f sbom.json
```
