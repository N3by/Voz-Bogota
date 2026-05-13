#!/bin/sh
set -e
NAMESPACE=voz-bogota

echo "==> Estado inicial del HPA:"
kubectl get hpa -n $NAMESPACE
kubectl get pods -n $NAMESPACE -l app=backend

echo ""
echo "==> Bajando umbral HPA a 20% para la demo (normal: 70%)..."
kubectl patch hpa backend-hpa -n $NAMESPACE --type=merge \
  -p '{"spec":{"metrics":[{"type":"Resource","resource":{"name":"cpu","target":{"type":"Utilization","averageUtilization":20}}}]}}'

echo ""
echo "==> Lanzando 3 pods generadores de carga dentro del cluster..."
kubectl run load-gen-1 --image=alpine --restart=Never --namespace=$NAMESPACE \
  --command -- sh -c "apk add --no-cache curl -q && while true; do curl -s http://backend:8000/health > /dev/null; done"
kubectl run load-gen-2 --image=alpine --restart=Never --namespace=$NAMESPACE \
  --command -- sh -c "apk add --no-cache curl -q && while true; do curl -s http://backend:8000/surveys > /dev/null; done"
kubectl run load-gen-3 --image=alpine --restart=Never --namespace=$NAMESPACE \
  --command -- sh -c "apk add --no-cache curl -q && while true; do curl -s http://backend:8000/health > /dev/null; done"

echo ""
echo "==> Generando carga durante 90 segundos. Observa el escalado automático:"
echo ""

i=1
while [ $i -le 6 ]; do
  echo "--- [${i}/6] t=$((i * 15))s ---"
  kubectl get hpa backend-hpa -n $NAMESPACE
  kubectl get pods -n $NAMESPACE -l app=backend
  echo ""
  sleep 15
  i=$((i + 1))
done

echo "==> Resultado final:"
kubectl get hpa -n $NAMESPACE
kubectl get pods -n $NAMESPACE

echo ""
echo "==> Limpiando pods de carga..."
kubectl delete pod load-gen-1 load-gen-2 load-gen-3 -n $NAMESPACE --ignore-not-found

echo ""
echo "==> Restaurando umbral HPA a 70%..."
kubectl patch hpa backend-hpa -n $NAMESPACE --type=merge \
  -p '{"spec":{"metrics":[{"type":"Resource","resource":{"name":"cpu","target":{"type":"Utilization","averageUtilization":70}}}]}}'

echo ""
echo "==> Demo completada."
echo "    - El HPA reducirá las réplicas gradualmente (~5 min de cool-down)."
echo "    - Umbral restaurado a 70% CPU."
