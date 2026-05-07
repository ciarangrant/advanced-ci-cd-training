# Lab 3: Infrastructure as Code (IaC) with Terraform

> **Which track are you following?**
>
> - **Cloud Labs** → Use the `terraform/` directory. You need AWS credentials.
> - **Local Labs** → Use the `terraform-local/` directory. Everything runs on your VM.

## Choose your track

> **Local Labs (primary):** Jump to [Local Labs Track](#local-labs-track) below.
> **Cloud Labs:** Continue reading sequentially.

## Overview

This lab provisions a small but realistic AWS footprint with Terraform: an S3 bucket with `prevent_destroy` and versioning plus a DynamoDB state-lock table, then migrates state from local disk onto an S3 remote backend. You wrap the whole thing in a GitHub Actions workflow that runs `terraform plan` on pull requests and `terraform apply` on merge to main, wiring pipeline discipline from Lab 1 into infrastructure change management. By the end you will have a working `terraform/` directory, a committed `.terraform.lock.hcl`, remote state living in S3 with DynamoDB locking, and a PR-driven apply workflow. This is the Module 3 worked-example pattern (configuration, state, backend, lock, workflow) applied end-to-end. Local-Lab learners do the same shape against Docker resources on their VM. It gives you the infrastructure substrate that the Module 4 deployment lab deploys *onto* and that the Module 7 hackathon provisions at full scale.

### Time Budget

| Task | Estimated Time |
|------|---------------|
| Setup and orientation | 3 min |
| Task 1: Write Terraform configuration | 7 min |
| Task 2: Configure remote backend | 5 min |
| Task 3: Create GitHub Actions workflow | 10 min |
| Task 4: .gitignore and lock file | 3 min |
| Review and teardown | 2 min |
| **Total** | **30 min** |

## Objectives

- Write a Terraform configuration that provisions AWS resources (S3 bucket, DynamoDB table)
- Configure a remote S3 backend with DynamoDB state locking
- Create a GitHub Actions workflow that runs `terraform plan` on pull requests and `terraform apply` on merge to main
- Commit `.terraform.lock.hcl` and configure `.gitignore` for a clean Terraform repository

## Prerequisites

- GitHub account with repository creation permissions
- Git installed locally
- Terraform CLI v1.14.x installed ([install guide](https://developer.hashicorp.com/terraform/install))
- AWS account with permissions to create S3 buckets and DynamoDB tables
- AWS CLI configured with credentials (`aws configure`)
- Completed Module 1 lab (familiarity with GitHub Actions workflows)

## Setup (summary)

> Your lab environment is pre-configured. If you encounter issues, ask your instructor.

Create the `terraform-lab-03` GitHub repo, copy the starter files in, set `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` as repo secrets, then set your `unique_suffix` (below). AWS credentials and the remote-state backend bucket are seeded for you.

### Set your unique suffix (lab-scoped decision)

S3 bucket names must be globally unique. To avoid collisions with other learners, open `terraform/variables.tf` and set the `unique_suffix` variable default to your GitHub username or initials (lowercase, no spaces). For example:

```hcl
variable "unique_suffix" {
  description = "Unique suffix to prevent S3 bucket name collisions (use your GitHub username or initials)"
  type        = string
  default     = "jsmith"   # <-- replace with YOUR GitHub username or initials
}
```

> **Important:** Every learner must use a different suffix. If two learners use the same suffix, `terraform apply` will fail because S3 bucket names are globally unique across all AWS accounts.

## Task 1: Write Terraform configuration

Complete the starter files in the `terraform/` directory to provision:

1. An S3 bucket named `<your-project>-data-dev-<your-suffix>` with:
   - `prevent_destroy = true` lifecycle rule
   - Tags: `Environment = "dev"`, `ManagedBy = "terraform"`

2. An S3 bucket versioning resource with versioning enabled

3. A DynamoDB table for state locking named `<your-project>-tf-locks` with:
   - Billing mode: `PAY_PER_REQUEST`
   - Hash key: `LockID` (type `S`)

> **Note:** The worked example in the slides uses `terraform_state` as the resource name and a `-tfstate-` bucket name (because it provisions a state backend). This lab uses `app_data` as the resource name and a `-data-` bucket name (for an application data bucket). The resource structure is the same; only the names differ. Follow the starter file comments for lab resource names.

**Files to edit:**

- `<course-repo>/labs/module-03/starter/terraform/main.tf` -- add resource blocks
- `<course-repo>/labs/module-03/starter/terraform/variables.tf` -- add variable definitions
- `<course-repo>/labs/module-03/starter/terraform/outputs.tf` -- add output blocks

**Validate locally:**

```bash
cd terraform/
terraform init
terraform validate
terraform plan
```

`terraform plan` should show 3 resources to add.

## Task 2: Configure remote backend

This is a two-phase process. First you create the backend resources with local state, then you migrate state to the remote backend.

**Phase 1** (already done in Task 1): You ran `terraform apply` with local state, which created the S3 bucket and DynamoDB table.

**Phase 2** (this task): Migrate state from local to remote.

1. Uncomment the `backend "s3"` block in `terraform/backend.tf`
2. Update the `bucket` value to match the S3 bucket name from Task 1 (e.g., `cicd-lab-data-dev-jsmith`)
3. Update the `dynamodb_table` value to match the DynamoDB table name from Task 1 (e.g., `cicd-lab-tf-locks`)
4. Run `terraform init -migrate-state` to migrate local state to the remote backend. This copies your local `terraform.tfstate` file to the S3 bucket.
5. Confirm the migration when prompted (answer `yes`)

**Validate:** Run `terraform plan` after migration. It should show `No changes. Infrastructure is up-to-date.`

## Task 3: Create GitHub Actions workflow

Complete the workflow file at `.github/workflows/terraform.yml`. The checkout step is already provided in the starter file. Complete the remaining steps to:

1. Trigger on push to `main` and pull requests to `main`
2. Set permissions: `contents: read`, `pull-requests: write`
3. Configure AWS credentials using the repository secrets
4. Run `terraform init`, `terraform validate`, and `terraform plan` on every trigger
5. Run `terraform apply -auto-approve` only on pushes to `main` (not on PRs)

**Action SHAs for pinning (provided in the starter file):**

- `actions/checkout` v4.2.2: `11bd71901bbe5b1630ceea73d27597364c9af683`
- `hashicorp/setup-terraform` v3.1.2: `b9cd54a3c349d3f38e8881555e7e3f22b67044a7`
- `aws-actions/configure-aws-credentials` v4.1.0: `ececac1a45f3b08a01d2dd070d28d111c5fe6722`

**Test:** Create a branch, make a minor change (e.g., add a tag), push, and open a PR. Verify that `terraform plan` runs. Merge the PR and verify that `terraform apply` runs on main.

## Task 4: .gitignore and lock file

1. Verify that `.gitignore` includes:
   - `.terraform/`
   - `*.tfstate`
   - `*.tfstate.backup`
   - `*.tfplan`
2. Verify that `.terraform.lock.hcl` is **not** in `.gitignore` (it must be committed)
3. Add and commit `.terraform.lock.hcl`:

```bash
git add terraform/.terraform.lock.hcl
git commit -m "Add Terraform provider lock file"
git push origin main
```

## Acceptance Criteria

- [ ] `terraform validate` passes with no errors
- [ ] `terraform plan` shows the expected resources (S3 bucket, versioning, DynamoDB table)
- [ ] S3 bucket has `prevent_destroy = true` lifecycle rule
- [ ] S3 bucket has versioning enabled
- [ ] DynamoDB table uses `PAY_PER_REQUEST` billing mode with `LockID` hash key
- [ ] Remote backend is configured and state is stored in S3
- [ ] GitHub Actions workflow runs `terraform plan` on pull requests
- [ ] GitHub Actions workflow runs `terraform apply` only on push to main
- [ ] All actions are pinned to commit SHAs (not mutable tags)
- [ ] `.terraform.lock.hcl` is committed to the repository
- [ ] `.gitignore` excludes `.terraform/`, `*.tfstate`, `*.tfstate.backup`, and `*.tfplan`
- [ ] No AWS credentials are hardcoded in any `.tf` or `.yml` file

## Recap & Takeaways

You authored a Terraform configuration that provisions three AWS resources (versioned S3 bucket with `prevent_destroy`, plus a DynamoDB lock table), migrated state from local disk to an S3 remote backend, and wrapped the whole thing in a GitHub Actions workflow that runs `plan` on pull requests and `apply` only on merges to `main`. You practised the Module 3 state-management pattern: `terraform init -migrate-state`, backend locking via DynamoDB, and committing `.terraform.lock.hcl` alongside a `.gitignore` that keeps plan and state artefacts out of source. The Local-Lab track exercises the same shape against Docker resources on your VM.

- You have a working Terraform configuration with remote S3 state and DynamoDB locking.
- You have a PR-driven apply workflow: `plan` on every change, `apply` only on merge to `main`.
- You know the difference between files that must be committed (`.terraform.lock.hcl`) and files that must not be (`*.tfstate`, `.terraform/`).

## Hints

<details><summary>Hint 1: S3 bucket resource</summary>

```hcl
resource "aws_s3_bucket" "app_data" {
  bucket = "${var.project_name}-data-${var.environment}-${var.unique_suffix}"

  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
```

</details>

<details><summary>Hint 2: Backend migration</summary>

After creating the S3 bucket and DynamoDB table with `terraform apply` (using local state), add the backend block and run:

```bash
terraform init -migrate-state
```

Terraform will ask: "Do you want to copy existing state to the new backend?" -- answer `yes`.

</details>

<details><summary>Hint 3: Apply only on main</summary>

Use an `if:` condition on the apply step. Gate on both the branch and the plan step's success:

```yaml
- name: Terraform apply
  if: github.ref == 'refs/heads/main' && github.event_name == 'push' && steps.plan.outcome == 'success'
  run: terraform apply -auto-approve tfplan
```

The `steps.plan.outcome == 'success'` check prevents apply from running when the plan step failed (which would produce a missing `tfplan` file error).

</details>

<details><summary>Hint 4: Plan file for consistent apply</summary>

Save the plan to a file with `-out`:

```bash
terraform plan -no-color -out=tfplan
```

Then apply that specific plan:

```bash
terraform apply -auto-approve tfplan
```

This guarantees the apply matches the reviewed plan.

</details>

<a id="local-labs-track"></a>

::: local-lab

### Local Labs Task Adaptations

If you are using the Local Labs track (`terraform-local/` directory):

**Task 1:** Edit `terraform-local/main.tf` to define `docker_image`, `docker_network`, and `docker_container` resources. Edit `terraform-local/variables.tf` to add validation. Edit `terraform-local/outputs.tf` to output the container name and URL.

**Task 2 (adapted):** The local backend is already configured in `terraform-local/backend.tf`. There is no remote state migration step on this track. Instead, run `terraform init` and verify the state file is created locally.

**Task 3 (adapted):** Create a `.gitea/workflows/terraform.yml` file (or `.github/workflows/terraform.yml` — Gitea reads both). The workflow should run `terraform init`, `terraform validate`, and `terraform plan` on all pushes/PRs, and `terraform apply` only on merge to main. No AWS credentials step is needed.

**Task 4:** Commit `terraform-local/.terraform.lock.hcl` (generated by `terraform init`) to version control.

### Local Labs Acceptance Criteria

- [ ] `terraform plan` shows 3 resources to create (image, network, container)
- [ ] `terraform apply` creates a running container accessible at `http://localhost:8080`
- [ ] `terraform destroy` removes all resources cleanly
- [ ] Variables have validation rules that reject invalid input
- [ ] Gitea Actions workflow runs plan on PRs and apply on merge to main

:::

## Teardown

Run `terraform destroy` to remove the lab stack and stop AWS charges accruing. The teardown has three known failure modes — work through them in order if the destroy errors:

```bash
cd terraform/

# Remove the prevent_destroy lifecycle rule from main.tf first,
# then run:
terraform apply   # Apply the config without prevent_destroy
terraform destroy # Destroy all resources
```

> **Note:** You must remove the `prevent_destroy` lifecycle rule before running `terraform destroy`, otherwise Terraform will refuse to delete the S3 bucket. This is the intended safety behaviour.

**Troubleshooting teardown failures:**

- **`Error: error configuring S3 Backend`** — Your AWS credentials have expired or are misconfigured. Run `aws sts get-caller-identity` to verify. If the credentials are invalid, run `aws configure` to refresh them before retrying.
- **`Error: Instance cannot be destroyed`** — You forgot to remove the `prevent_destroy` lifecycle rule. Edit `main.tf`, remove the `lifecycle { prevent_destroy = true }` block, run `terraform apply`, then retry `terraform destroy`.
- **Backend state conflict after destroy** — If `terraform destroy` removes the S3 bucket and DynamoDB table that are also the configured backend, subsequent commands will fail (the backend no longer exists). To avoid this: before destroying, comment out the `backend "s3"` block in `backend.tf` and run `terraform init -migrate-state` to move state back to local, then run `terraform destroy`.

## Troubleshooting: If AWS Is Unavailable

AWS credentials are the most common lab blocker. If you cannot authenticate with AWS, use these fallback approaches so you can still complete the learning objectives.

**Option 1: Dry-run mode with `terraform plan`**

If `aws sts get-caller-identity` fails or you do not have AWS credentials, you can still complete Tasks 1, 3, and 4. Run `terraform plan` instead of `terraform apply` -- this validates your configuration and shows what Terraform *would* create without actually provisioning resources. Skip Task 2 (backend migration requires a real S3 bucket). Your workflow file (Task 3) will still be syntactically complete and ready to run when credentials become available.

```bash
terraform init    # Downloads providers (works without credentials)
terraform validate  # Checks HCL syntax (works without credentials)
terraform plan    # Shows planned resources (will warn about missing credentials but still validates config structure)
```

**Option 2: Use the local-labs Docker provider track**

If you have no AWS credentials and your Local Labs VM is provisioned,
switch to `terraform-local/` (sibling directory to `terraform/`). It uses
the `kreuzwerker/docker` provider against the VM's Podman daemon — no
AWS account required, and every Terraform concept the module teaches
(providers, state, plan / apply, lock files, modules) transfers 1:1.

**Option 3: Expected `terraform plan` output (reference)**

If you are blocked and cannot run `terraform plan` against AWS, compare your configuration against this expected plan structure. A correct Task 1 configuration produces exactly 3 resources to add:

```
Terraform used the selected providers to generate the following execution plan.
Resource actions are indicated with the following symbols:
  + create

Terraform will perform the following actions:

  # aws_dynamodb_table.tf_locks will be created
  + resource "aws_dynamodb_table" "tf_locks" {
      + billing_mode   = "PAY_PER_REQUEST"
      + hash_key       = "LockID"
      + name           = "cicd-lab-tf-locks"
      + tags           = {
          + "Environment" = "dev"
          + "ManagedBy"   = "terraform"
        }
      + attribute {
          + name = "LockID"
          + type = "S"
        }
    }

  # aws_s3_bucket.app_data will be created
  + resource "aws_s3_bucket" "app_data" {
      + bucket = "cicd-lab-data-dev-jsmith"
      + tags   = {
          + "Environment" = "dev"
          + "ManagedBy"   = "terraform"
        }
      + lifecycle {
          + prevent_destroy = true
        }
    }

  # aws_s3_bucket_versioning.app_data will be created
  + resource "aws_s3_bucket_versioning" "app_data" {
      + bucket = (known after apply)
      + versioning_configuration {
          + status = "Enabled"
        }
    }

Plan: 3 to add, 0 to change, 0 to destroy.
```

Resource names, bucket name suffix, and tag values will vary based on your `unique_suffix` and variable defaults — the structure and resource count should match.
