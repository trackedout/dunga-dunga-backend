set dotenv-load # Load environment variables from .env file

_default:
    @just --list --unsorted

_sync-now node:
  rsync -rav --mkpath ./src/ {{node}}:/tracked-out/dunga-dunga/src/

dev-sync node="salt":
  #!/bin/bash
  just _sync-now {{node}}

  # ins inotify-tools
  while inotifywait -r -e modify,create,delete src; do
    just _sync-now {{node}}
  done

dev_docker_image := "dunga-dunga-backend:dev"
prod_docker_image := "dunga-dunga-backend:latest"

registry := "registry.trackedout.org/dunga-dunga"

# Build dev image
build-dev-image:
  docker build -t {{dev_docker_image}} -f Dockerfile-dev .

# Build prod image
build-prod-image:
  docker build -t {{prod_docker_image}} -f Dockerfile .

# Push dev image to k3s registry
push-dev-image:
  docker tag {{dev_docker_image}} {{registry}}:dev
  docker push {{registry}}:dev

# Push prod image to k3s registry
push-prod-image:
  docker tag {{prod_docker_image}} {{registry}}:latest
  docker push {{registry}}:latest

# Push both dev and prod images
push-images: push-dev-image push-prod-image

# Build and push dev images
build-and-push-dev: build-dev-image push-dev-image

# Build and push prod images
build-and-push-prod: build-prod-image push-prod-image

# Build, push, and deploy to k3s cluster - dev
dev-deploy: build-and-push-dev
  k3s kubectl patch deployment -n davybones dunga-dunga -p '{"spec":{"template":{"spec":{"containers":[{"name":"dunga-dunga","image": "{{registry}}:dev", "imagePullPolicy":"Always"}]}}}}'
  k3s kubectl rollout restart -n davybones deployment/dunga-dunga

# Build, push, and deploy to k3s cluster - prod
prod-deploy: build-and-push-prod
  k3s kubectl patch deployment -n davybones dunga-dunga -p '{"spec":{"template":{"spec":{"containers":[{"name":"dunga-dunga","image": "{{registry}}:latest", "imagePullPolicy":"Always"}]}}}}'
  k3s kubectl rollout restart -n davybones deployment/dunga-dunga

