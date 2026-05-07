# Lab 4: Advanced Deployment Strategies

> **Which track are you following?**
>
> - **Cloud Labs** → Use the standard files and instructions below.
> - **Local Labs** → See the "Local Labs" callouts for alternative paths.

## Overview

This lab exercises the two levers that make modern deployments safe: feature flags at the application layer and weighted traffic routing at the ingress layer. You add a `new-dashboard-widget` flag to a small Express service, wire it into the `/dashboard` route so the widget is conditionally rendered, and then configure Kubernetes manifests for a 95:5 canary split between a stable and a canary deployment. You finish by practising both rollback paths — flipping the flag off and shifting traffic back to 100:0. By the end you will have a `config/flags.json`, a `src/flags.js` helper, a working canary `Deployment` and `Service`, and an ALB-weighted (or Traefik-weighted) Ingress, all validated with `kubectl apply --dry-run=client`. This lab cements the Module 4 concepts of progressive delivery, runtime-configurable behaviour, and the two-stage rollback drill that underpins the blue/green work in the Module 7 hackathon.

### Time Budget

| Task | Estimated Time |
|------|---------------|
| Setup and orientation | 4 min |
| Task 1: Feature flag configuration | 8 min |
| Task 2: Wire the flag into the application | 8 min |
| Task 3: Traffic splitting configuration | 10 min |
| Task 4: Test rollback | 4 min |
| Review and teardown | 2 min |
| **Total** | **36 min** |

## Objectives

- Implement a feature flag configuration that controls the visibility of a new application component
- Wire the feature flag into application code so the component is hidden when the flag is off
- Configure traffic splitting between a stable and canary version using weighted routing
- Verify rollback by disabling the flag and shifting traffic back to the stable version

## Prerequisites

- Node.js 20 or later installed locally
- `kubectl` installed locally (dry-run validation does not require a live cluster connection)
- Git installed locally
- A text editor

## Setup (summary)

> Your lab environment is pre-configured. If you encounter issues, ask your instructor.

Create `deployment-lab-04`, copy the starter files in, and `npm install`: `mkdir deployment-lab-04 && cd deployment-lab-04 && git init`, copy starter, `npm install`.

## Task 1: Feature flag configuration

Create a feature flag configuration file that controls a "new dashboard widget" component.

1. Open `config/flags.json` in the starter directory. It contains an empty flags structure.

2. Add a feature flag named `new-dashboard-widget` with `enabled` set to `false`:

```json
{
  "version": "1",
  "flags": {
    "new-dashboard-widget": {
      "name": "New Dashboard Widget",
      "description": "Controls visibility of the new dashboard widget"
    }
  },
  "values": {
    "new-dashboard-widget": {
      "enabled": false
    }
  }
}
```

3. Open `src/flags.js` in the starter directory. Complete the `isEnabled(flagName)` function so it reads from `config/flags.json` and returns the `enabled` value for the given flag name. The starter file has a `TODO` comment marking where to add the logic.

4. Run the tests to verify your flag configuration:

```bash
npm test
```

The test `flags.isEnabled returns false for disabled flag` should pass.

## Task 2: Wire the flag into the application

Use the feature flag to control whether the `/dashboard` endpoint includes the new widget in its response.

1. Open `src/index.js`. Find the `/dashboard` route handler.

2. Import the flags module and add a conditional check: if `new-dashboard-widget` is enabled, include a `widget` field in the JSON response. If disabled, omit it.

3. Test locally:

```bash
npm start
```

Visit `http://localhost:3000/dashboard`. The response should **not** include a `widget` field.

4. Edit `config/flags.json` and set `"enabled": true` for `new-dashboard-widget`.

5. Restart the server and visit `http://localhost:3000/dashboard` again. The response should now include `"widget": {"type": "analytics", "title": "New Dashboard Widget"}`.

6. Run the full test suite to confirm both flag states are tested:

```bash
npm test
```

## Task 3: Traffic splitting configuration

Configure Kubernetes manifests for a canary deployment with weighted traffic routing.

1. Open `k8s/stable-deployment.yaml` in the starter directory. It contains a Deployment and Service for the stable version (v1.0). Review the labels and the readiness probe.

2. Open `k8s/canary-deployment.yaml`. Complete the manifest to create a canary Deployment and Service for v1.1. The starter file has `TODO` markers. Requirements:
   - Deployment name: `app-canary`
   - Replicas: 1
   - Labels: `app: myapp`, `version: canary`
   - Image: `myapp:v1.1`
   - Service name: `app-canary`
   - Service selector must match the canary labels
   - Include a readiness probe on `/health` port 3000

3. Open `k8s/ingress.yaml`. Complete the ALB weighted routing annotation to split traffic 95% to `app-stable` and 5% to `app-canary`. The starter file has a `TODO` marker with the annotation structure.

4. Validate the YAML syntax. The `--dry-run=client` flag validates locally and does not require a cluster connection:

```bash
kubectl apply --dry-run=client -f k8s/stable-deployment.yaml
kubectl apply --dry-run=client -f k8s/canary-deployment.yaml
kubectl apply --dry-run=client -f k8s/ingress.yaml
```

All three commands should report the resources as valid.

## Task 4: Test rollback

Verify that you can roll back both the feature flag and the traffic split.

1. **Feature flag rollback:** Edit `config/flags.json` and set `new-dashboard-widget` back to `"enabled": false`. Restart the application. Confirm the `/dashboard` endpoint no longer includes the `widget` field.

2. **Traffic rollback:** Edit `k8s/ingress.yaml` and change the weights to 100:0 (all traffic to stable, none to canary). Validate with `kubectl apply --dry-run=client -f k8s/ingress.yaml`.

3. Commit your completed work:

```bash
git add -A
git commit -m "Complete lab 04: feature flags and canary deployment"
```

## Acceptance Criteria

- [ ] `config/flags.json` contains a `new-dashboard-widget` flag with correct structure
- [ ] `src/flags.js` correctly reads the flag file and returns the `enabled` value
- [ ] `/dashboard` endpoint omits the widget when the flag is `false`
- [ ] `/dashboard` endpoint includes the widget when the flag is `true`
- [ ] `k8s/canary-deployment.yaml` defines a valid Deployment and Service for the canary version
- [ ] `k8s/ingress.yaml` has ALB weighted routing with a 95:5 stable-to-canary split
- [ ] Traffic rollback (100:0 weights) validates with `kubectl apply --dry-run=client`
- [ ] All tests pass (`npm test`)

::: local-lab

### Local Labs Task Adaptations

**Task 3 (adapted):** Instead of completing `k8s/ingress.yaml` with ALB annotations, complete `k8s/traefik-weighted.yaml` with Traefik IngressRoute weighted services. Set `app-stable` to weight 95 and `app-canary` to weight 5.

**Task 4 (adapted):** To verify traffic splitting, add `app.local` to `/etc/hosts`:
```bash
echo "127.0.0.1 app.local" | sudo tee -a /etc/hosts
```
Then send requests and verify the split:
```bash
for i in $(seq 1 100); do curl -s http://app.local/version; done | sort | uniq -c
```

### Local Labs Acceptance Criteria (replaces ALB criteria)

- [ ] `k8s/traefik-weighted.yaml` has Traefik IngressRoute with 95:5 stable-to-canary split
- [ ] `kubectl apply -f k8s/traefik-weighted.yaml` applies without errors
- [ ] Traffic test shows approximately 95% stable and 5% canary responses

:::

## Recap & Takeaways

You implemented a feature flag (`new-dashboard-widget`) that controls a runtime branch in the `/dashboard` handler, and you configured Kubernetes manifests for a 95:5 canary split — either ALB weighted routing (Cloud Labs) or a Traefik `IngressRoute` (Local Labs). You then rehearsed both rollback paths: flipping the flag back to `false` to hide the widget without a redeploy, and rewriting the traffic weights to 100:0 to pull users off the canary. That pairing of application-level flag and ingress-level weight is the Module 4 progressive-delivery playbook.

- You have a working flag system (`config/flags.json` + `src/flags.js`) wired into the `/dashboard` route.
- You have canary manifests that validate under `kubectl apply --dry-run=client`, with weighted routing at 95:5 and a validated 100:0 rollback state.
- You know the two rollback drills — flip the flag vs. shift the weights — and when each one applies.

## Hints

<details><summary>Hint 1: Reading the flags file in Node.js</summary>

Use `fs.readFileSync` to read the JSON file and `JSON.parse` to parse it:

```javascript
const fs = require('node:fs');
const path = require('node:path');

const flagsPath = path.join(__dirname, '..', 'config', 'flags.json');
const flagData = JSON.parse(fs.readFileSync(flagsPath, 'utf8'));
```

</details>

<details><summary>Hint 2: The dashboard route conditional</summary>

```javascript
const response = { user: 'demo-user', timestamp: Date.now() };

if (flags.isEnabled('new-dashboard-widget')) {
  response.widget = {
    type: 'analytics',
    title: 'New Dashboard Widget'
  };
}

res.json(response);
```

</details>

<details><summary>Hint 3: Canary Deployment labels</summary>

The canary Deployment must have `version: canary` in both the selector and the template labels. The Service selector must match: `app: myapp` and `version: canary`.

</details>

<details><summary>Hint 4: ALB weighted routing annotation</summary>

The annotation value is JSON inside a YAML string. The key fields are `serviceName`, `servicePort`, and `weight` inside the `targetGroups` array.

```yaml
alb.ingress.kubernetes.io/actions.weighted-routing: |
  {
    "type": "forward",
    "forwardConfig": {
      "targetGroups": [
        { "serviceName": "app-stable", "servicePort": 80, "weight": 95 },
        { "serviceName": "app-canary", "servicePort": 80, "weight": 5 }
      ]
    }
  }
```

</details>

## Teardown

Most learners stay in dry-run mode for this lab, so teardown is a no-op unless you applied manifests to a live cluster. If you did:

```bash
# If you applied resources to a cluster:
kubectl delete -f k8s/ingress.yaml 2>/dev/null
kubectl delete -f k8s/canary-deployment.yaml 2>/dev/null
kubectl delete -f k8s/stable-deployment.yaml 2>/dev/null

# Remove the lab directory if desired:
cd .. && rm -rf deployment-lab-04
```
