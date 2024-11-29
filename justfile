set dotenv-load # Load environment variables from .env file

_default:
    @just --list --unsorted

dev-sync node="salt":
  #!/bin/bash
  # ins inotify-tools
  while inotifywait -r -e modify,create,delete src; do
    rsync -rav --mkpath ./src/ {{node}}:/tracked-out/dunga-dunga/src/
  done

docker_image := "dunga-dunga-backend:dev"

# Build docker image
build-image:
  docker build -t {{docker_image}} -f Dockerfile-dev .

# Push docker image to k3s registry
push-image:
  docker tag dunga-dunga-backend:dev registry.trackedout.org/dunga-dunga:dev
  docker push registry.trackedout.org/dunga-dunga:dev

# Build and push
build-and-push: build-image push-image

# Build, push, and deploy to k3s cluster
deploy: build-and-push
  k3s kubectl patch deployment -n davybones dunga-dunga -p '{"spec":{"template":{"spec":{"containers":[{"name":"dunga-dunga","image": "registry.trackedout.org/dunga-dunga:dev", "imagePullPolicy":"Always"}]}}}}'
  k3s kubectl rollout restart -n davybones deployment/dunga-dunga

