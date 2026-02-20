#!/bin/bash
set -e

git reset --hard
git pull origin master

echo "🚀 STATIC-ENGINE Backend Docker deployment started..."

cd "$(dirname "$0")"

if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "Please create .env file and fill in all variables"
    exit 1
fi

echo "🧹 Stopping old containers..."
docker compose down

echo "🔨 Building Docker image..."
docker compose build --no-cache

echo "▶️  Starting containers..."
docker compose up -d

echo "⏳ Waiting for backend..."
sleep 10

echo "📊 Container status:"
docker compose ps

echo "✅ Backend deployment finished!"
echo "🌐 Backend is running at http://localhost:4009"
echo ""
echo "📝 Useful commands:"
echo "   docker compose logs -f static-engine  - View backend logs"
echo "   docker compose logs -f redis           - View Redis logs"
echo "   docker compose ps                      - Container status"
echo "   docker compose down                    - Stop all containers"

docker compose logs --tail 200 -f
