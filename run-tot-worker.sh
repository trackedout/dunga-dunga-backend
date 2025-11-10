#!/bin/bash

# Script to run ToT worker once in Docker container with local MongoDB

set -e

echo "🚀 Starting ToT Worker Script..."

# Start MongoDB container if not running
if ! docker ps | grep -q mongodb; then
    echo "🐳 Starting MongoDB container..."
    docker-compose up -d mongodb
    echo "⏳ Waiting for MongoDB to be ready..."
    sleep 5
else
    echo "✅ MongoDB container already running"
fi

# Build and run the ToT worker
echo "🔨 Building Docker image and running ToT worker..."
docker-compose run --rm -e NODE_ENV=development dunga-dunga sh -c "yarn compile && node --experimental-modules --es-module-specifier-resolution=node dist/tot-runner-once.js"

echo -e "\n✅ ToT Worker execution completed!"
