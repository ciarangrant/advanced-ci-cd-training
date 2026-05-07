terraform {
  required_version = ">= 1.14.0"
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}

provider "docker" {
  # Uses DOCKER_HOST from the learner shell / Gitea runner.
  # Local Labs sets this to the rootless Podman socket:
  # unix:///run/user/<uid>/podman/podman.sock
}
