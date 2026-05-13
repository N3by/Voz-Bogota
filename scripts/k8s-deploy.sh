#!/bin/sh
set -e
NAMESPACE=voz-bogota

echo "==> Aplicando namespace..."
kubectl apply -f k8s/namespace.yaml

echo "==> Creando/actualizando secret desde .env..."
kubectl create secret generic voz-secrets \
  --namespace=$NAMESPACE \
  --from-literal=POSTGRES_USER=$(grep ^POSTGRES_USER .env | cut -d= -f2-) \
  --from-literal=POSTGRES_PASSWORD=$(grep ^POSTGRES_PASSWORD .env | cut -d= -f2-) \
  --from-literal=POSTGRES_DB=$(grep ^POSTGRES_DB .env | cut -d= -f2-) \
  --from-literal=DATABASE_URL=$(grep ^DATABASE_URL .env | cut -d= -f2-) \
  --from-literal=REDIS_URL=$(grep ^REDIS_URL .env | cut -d= -f2-) \
  --from-literal=SECRET_KEY=$(grep ^SECRET_KEY .env | cut -d= -f2-) \
  --from-literal=ADMIN_SETUP_KEY=$(grep ^ADMIN_SETUP_KEY .env | cut -d= -f2-) \
  --dry-run=client -o yaml | kubectl apply -f -

echo "==> Aplicando ConfigMap..."
kubectl apply -f k8s/configmaps/

echo "==> Aplicando PostgreSQL..."
kubectl apply -f k8s/postgres/

echo "==> Aplicando Redis..."
kubectl apply -f k8s/redis/

echo "==> Aplicando Backend..."
kubectl apply -f k8s/backend/

echo "==> Aplicando Frontend..."
kubectl apply -f k8s/frontend/

echo "==> Aplicando Ingress..."
kubectl apply -f k8s/ingress.yaml

echo ""
echo "==> Esperando que los pods estén listos (hasta 3 min)..."
kubectl rollout status deployment/postgres -n $NAMESPACE --timeout=180s
kubectl rollout status deployment/redis -n $NAMESPACE --timeout=180s
kubectl rollout status deployment/backend -n $NAMESPACE --timeout=180s
kubectl rollout status deployment/frontend -n $NAMESPACE --timeout=180s

echo ""
echo "==> Estado final:"
kubectl get pods -n $NAMESPACE
echo ""
echo "==> Para acceder a la app, en otra terminal ejecuta: minikube tunnel"
echo "==> Luego abre: http://localhost"
