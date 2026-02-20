#!/bin/bash



# PRODUCTION
git reset --hard
git checkout master  # If branch is master
git pull origin master

# Update and rebuild container
# This command stops and removes the old container, then builds a new one
docker stop static-frontend
docker remove static-frontend
docker compose up -d --build

echo "🚀 STATIC-ENGINE Frontend Docker deployment started..."

if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file with NEXT_PUBLIC_API_URL"
    exit 1
fi

# Clean up unused old images
docker image prune -f

docker compose logs --tail 200 -f
