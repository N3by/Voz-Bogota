# Fase 5 — Migración a Kubernetes (minikube)

**Proyecto:** Voz Bogotá — Sistema de Participación Ciudadana  
**Stack:** React 18 · FastAPI · PostgreSQL 15 · Redis 7  
**Herramientas:** minikube v1.38.1 · kubectl v1.36.1 · Kubernetes v1.35.1

---

## Objetivo

Migrar la aplicación (previamente contenerizada con Docker Compose en la Fase 4) a un clúster local de Kubernetes usando minikube, implementando los conceptos fundamentales de K8s: Namespace, Deployment, Service, Ingress, ConfigMap, Secret, PersistentVolumeClaim y HorizontalPodAutoscaler.

---

## Paso 1 — Instalación de herramientas

```bash
brew install minikube
brew install kubectl
```

**Versiones instaladas:**
- minikube v1.38.1
- kubectl v1.36.1 (Kubernetes v1.35.1)

---

## Paso 2 — Inicializar el clúster minikube

```bash
minikube start --driver=docker
```

minikube crea un clúster de un solo nodo dentro de un contenedor Docker. Al usar `--driver=docker` no se requiere una máquina virtual completa.

**Resultado:**
```
NAME       STATUS   ROLES           VERSION
minikube   Ready    control-plane   v1.35.1
```

---

## Paso 3 — Habilitar addons

```bash
minikube addons enable ingress
minikube addons enable metrics-server
```

| Addon | Propósito |
|---|---|
| `ingress` | Controlador nginx que expone la app al exterior del clúster |
| `metrics-server` | Recolecta métricas de CPU/memoria (necesario para el HPA) |

---

## Paso 4 — Estructura de manifiestos

Se creó el directorio `k8s/` con la siguiente organización:

```
k8s/
├── namespace.yaml              # Aísla todos los recursos del proyecto
├── ingress.yaml                # Punto de entrada único al clúster
├── configmaps/
│   └── backend-config.yaml    # Variables de entorno no sensibles
├── secrets/
│   └── secrets.example.yaml   # Plantilla base64 (el archivo real no se commitea)
├── postgres/
│   ├── pvc.yaml               # Disco persistente 1 Gi para la base de datos
│   ├── deployment.yaml
│   └── service.yaml
├── redis/
│   ├── deployment.yaml
│   └── service.yaml
├── backend/
│   ├── deployment.yaml        # 2 réplicas con liveness/readiness probes
│   ├── service.yaml
│   └── hpa.yaml               # Escala automática 2–5 pods según CPU
└── frontend/
    ├── deployment.yaml        # 2 réplicas, nginx sirviendo la app React
    ├── service.yaml
    └── hpa.yaml
```

---

## Paso 5 — Namespace

**Archivo:** `k8s/namespace.yaml`

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: voz-bogota
```

**Por qué:** Un Namespace aísla lógicamente todos los recursos del proyecto dentro del clúster. Permite aplicar políticas, quotas y RBAC por proyecto.

---

## Paso 6 — ConfigMap y Secret

### ConfigMap — `k8s/configmaps/backend-config.yaml`

Almacena variables de entorno **no sensibles** del backend:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: backend-config
  namespace: voz-bogota
data:
  ALGORITHM: "HS256"
  ACCESS_TOKEN_EXPIRE_MINUTES: "60"
  APP_ENV: "production"
  CORS_ORIGINS: "http://localhost"
```

### Secret — `k8s/secrets/secrets.example.yaml`

Almacena variables **sensibles** codificadas en base64 (POSTGRES_PASSWORD, SECRET_KEY, DATABASE_URL, etc.). El archivo con valores reales se genera en tiempo de despliegue desde `.env` y **nunca se commitea** al repositorio.

```yaml
# EJEMPLO — No usar en producción.
# Generar con: echo -n "valor_real" | base64
apiVersion: v1
kind: Secret
metadata:
  name: voz-secrets
  namespace: voz-bogota
type: Opaque
data:
  POSTGRES_USER: dm96X3VzZXI=
  POSTGRES_PASSWORD: Y2hhbmdlX21l
  # ...
```

---

## Paso 7 — PostgreSQL con almacenamiento persistente

### PersistentVolumeClaim — `k8s/postgres/pvc.yaml`

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: voz-bogota
spec:
  storageClassName: standard
  accessModes: [ReadWriteOnce]
  resources:
    requests:
      storage: 1Gi
```

minikube provisiona el PV automáticamente gracias al `StorageClass: standard`. No es necesario crear un PersistentVolume manualmente.

### Deployment — `k8s/postgres/deployment.yaml`

Puntos clave:
- Imagen `postgres:15-alpine`
- Credenciales inyectadas desde `voz-secrets` (secretKeyRef)
- `subPath: pgdata` en el volumeMount para evitar conflictos de permisos
- `readinessProbe` con `pg_isready` para garantizar que el pod solo recibe tráfico cuando la BD está lista

### Service — `k8s/postgres/service.yaml`

```yaml
type: ClusterIP   # Solo accesible dentro del clúster
port: 5432
```

---

## Paso 8 — Redis

Sin persistencia (usado solo como caché en memoria).

### Deployment — `k8s/redis/deployment.yaml`

```yaml
command: ["redis-server", "--save", "", "--appendonly", "no"]
```

Deshabilita explícitamente el volcado a disco (RDB y AOF).

- `readinessProbe`: `redis-cli ping`
- Imagen: `redis:7-alpine`

### Service — `k8s/redis/service.yaml`

```yaml
type: ClusterIP
port: 6379
```

---

## Paso 9 — Backend (FastAPI)

### Deployment — `k8s/backend/deployment.yaml`

Puntos clave:
- **2 réplicas** para alta disponibilidad
- `imagePullPolicy: Never` — usa la imagen construida localmente en minikube (no intenta descargarla de un registry externo)
- Variables inyectadas con `envFrom` (configMapRef + secretRef) — más limpio que declarar cada variable individualmente
- **livenessProbe**: si `/health` falla 3 veces, Kubernetes reinicia el pod
- **readinessProbe**: el pod solo recibe tráfico cuando `/health` responde correctamente

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 30
  periodSeconds: 30
  failureThreshold: 3
readinessProbe:
  httpGet:
    path: /health
    port: 8000
  initialDelaySeconds: 15
  periodSeconds: 10
  failureThreshold: 3
```

### HorizontalPodAutoscaler — `k8s/backend/hpa.yaml`

```yaml
minReplicas: 2
maxReplicas: 5
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

Si el promedio de CPU supera el 70%, Kubernetes escala automáticamente hasta 5 réplicas.

---

## Paso 10 — Frontend (React + nginx)

### Deployment — `k8s/frontend/deployment.yaml`

- Imagen `voz-frontend:latest` — construida en la Fase 3 (multi-stage: Node compila → nginx sirve el bundle)
- `imagePullPolicy: Never`
- **2 réplicas**
- `readinessProbe` en `/` (HTTP 200)

El nginx dentro del contenedor ya incluye:
- Compresión gzip
- Headers de seguridad (`X-Frame-Options`, `X-Content-Type-Options`)
- Proxy inverso `/api/` → `http://backend:8000/` (resuelto por el DNS interno del clúster)
- SPA fallback (`try_files $uri /index.html`)

### HPA — `k8s/frontend/hpa.yaml`

Igual que el backend: escala 2–5 pods al 70% de CPU.

---

## Paso 11 — Ingress

**Archivo:** `k8s/ingress.yaml`

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: voz-ingress
  namespace: voz-bogota
spec:
  ingressClassName: nginx
  rules:
  - http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 80
```

El Ingress es el único punto de entrada al clúster. Todo el tráfico entra por aquí y es enrutado al servicio `frontend`. Las llamadas a `/api/...` son manejadas por el proxy nginx dentro del pod frontend, que las reenvía internamente al servicio `backend`.

---

## Paso 12 — Scripts de automatización

### `scripts/k8s-build.sh`

Apunta el cliente Docker al daemon de minikube y construye ambas imágenes:

```bash
eval $(minikube docker-env)
docker build -t voz-backend:latest ./backend
docker build -t voz-frontend:latest ./frontend
```

### `scripts/k8s-deploy.sh`

Aplica todos los manifiestos en el orden correcto y espera a que cada Deployment termine su rollout:

```bash
kubectl apply -f k8s/namespace.yaml
kubectl create secret generic voz-secrets --from-literal=... | kubectl apply -f -
kubectl apply -f k8s/configmaps/
kubectl apply -f k8s/postgres/
kubectl apply -f k8s/redis/
kubectl apply -f k8s/backend/
kubectl apply -f k8s/frontend/
kubectl apply -f k8s/ingress.yaml
kubectl rollout status deployment/backend -n voz-bogota --timeout=180s
# ...
```

---

## Paso 13 — Despliegue y verificación

### Ejecución

```bash
# 1. Construir imágenes en el daemon de minikube
./scripts/k8s-build.sh

# 2. Desplegar todo en el clúster
./scripts/k8s-deploy.sh
```

### Estado final del clúster

```
NAME                        READY   STATUS    RESTARTS
backend-644c7f48c4-lgwsc    1/1     Running   0
backend-644c7f48c4-vbbwz    1/1     Running   0
frontend-7859dc5f76-g4gj4   1/1     Running   0
frontend-7859dc5f76-hbbw7   1/1     Running   0
postgres-64845d88c5-7kn2m   1/1     Running   0
redis-5846d5dfdb-ntt9v      1/1     Running   0
```

### Smoke tests

```bash
# Test del backend (via port-forward)
kubectl port-forward svc/backend 8001:8000 -n voz-bogota
curl http://localhost:8001/health
# → {"status":"ok","app":"Voz Bogotá"}

# Test del frontend (via port-forward)
kubectl port-forward svc/frontend 8080:80 -n voz-bogota
curl -I http://localhost:8080/
# → HTTP/1.1 200 OK
```

### Acceso desde el navegador

```bash
# En una terminal separada (requiere permisos sudo)
minikube tunnel

# Abrir en el navegador
http://localhost
```

---

## Resumen de objetos Kubernetes creados

| Objeto K8s | Nombre | Descripción |
|---|---|---|
| Namespace | `voz-bogota` | Aísla todos los recursos del proyecto |
| ConfigMap | `backend-config` | Variables no sensibles del backend |
| Secret | `voz-secrets` | Credenciales y claves (base64) |
| PersistentVolumeClaim | `postgres-pvc` | Disco de 1 Gi para PostgreSQL |
| Deployment | `postgres` | Base de datos, 1 réplica |
| Deployment | `redis` | Caché en memoria, 1 réplica |
| Deployment | `backend` | API FastAPI, **2 réplicas** |
| Deployment | `frontend` | App React + nginx, **2 réplicas** |
| Service (ClusterIP) | `postgres` | DNS interno: `postgres:5432` |
| Service (ClusterIP) | `redis` | DNS interno: `redis:6379` |
| Service (ClusterIP) | `backend` | DNS interno: `backend:8000` |
| Service (ClusterIP) | `frontend` | DNS interno: `frontend:80` |
| HPA | `backend-hpa` | Escala backend 2–5 pods (CPU 70%) |
| HPA | `frontend-hpa` | Escala frontend 2–5 pods (CPU 70%) |
| Ingress | `voz-ingress` | Punto de entrada público (nginx) |
