# ── Local Labs: Docker Provider ──────────────────────────
# Provision containers on your VM instead of AWS resources.
# The Terraform workflow (init, plan, apply, destroy) is identical.

# TODO: Define a docker_image resource for "nginx:1.27-alpine"
#       with keep_locally = true
#
# Hint:
#   resource "docker_image" "app" {
#     name         = "..."
#     keep_locally = true
#   }

# TODO: Define a docker_network resource named
#       "${var.project_name}-network"

# TODO: Define a docker_container resource that:
#       - Uses the image ID from docker_image.app
#       - Maps internal port 80 to external var.app_port
#       - Connects to the docker_network
#       - Includes a healthcheck:
#           test     = ["CMD", "wget", "--spider", "-q", "http://localhost/"]
#           interval = "10s"
#           timeout  = "5s"
#           retries  = 3
