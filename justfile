set dotenv-load # Load environment variables from .env file

_default:
    @just --list --unsorted

docker_image := "dunga-dunga-backend:dev"

# Build docker image
build-image:
  docker build -t {{docker_image}} .

# Import docker images into k3s
import-image:
  docker image save {{docker_image}} | sudo k3s ctr images import -

# Build and import
build-and-import: build-image import-image

# Build, import, and deploy to k3s cluster
deploy: build-and-import
  k3s kubectl patch deployment -n davybones dunga-dunga -p '{"spec":{"template":{"spec":{"containers":[{"name":"dunga-dunga","image": "dunga-dunga-backend:dev", "imagePullPolicy":"Never"}]}}}}'
  k3s kubectl rollout restart -n davybones deployment/dunga-dunga

