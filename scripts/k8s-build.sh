#!/bin/sh
set -e
echo "==> Apuntando al daemon Docker de minikube..."
eval $(minikube docker-env)
echo "==> Construyendo voz-backend:latest..."
docker build -t voz-backend:latest ./backend
echo "==> Construyendo voz-frontend:latest..."
docker build -t voz-frontend:latest ./frontend
echo "==> Imágenes listas en minikube."
docker images | grep voz
