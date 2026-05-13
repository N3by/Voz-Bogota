# Voz Bogotá

Sistema de participación ciudadana para Bogotá. Aplicación web **mobile-first** que permite a los ciudadanos responder encuestas sobre su comunidad y visualizar los resultados en un mapa de calor por localidad. Construida como demostración práctica del stack completo: React → FastAPI → PostgreSQL → Redis → Docker → Kubernetes.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 · Vite · Zustand · React Router · Leaflet · Recharts |
| Backend | Python 3.13 · FastAPI · SQLAlchemy · Alembic · JWT (PyJWT) · bcrypt |
| Base de datos | PostgreSQL 15 |
| Caché | Redis 7 |
| Contenedores | Docker · Docker Compose |
| Orquestación | Kubernetes (minikube) · HPA · Ingress nginx |

---

## Fases de desarrollo

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Fundación local — MVP completo sin Docker | ✅ Completa |
| 2 | Verificación de integración end-to-end | ✅ Completa |
| 3 | Dockerización de componentes | ✅ Completa |
| 4 | Orquestación con Docker Compose | ✅ Completa |
| 5 | Migración a Kubernetes (minikube) | ✅ Completa |
| 6 | Kubernetes completo con HPA bajo carga real | ✅ Completa |

---

## Inicio rápido

### Opción A — Docker Compose (recomendado)

```bash
cp .env.example .env        # ajustar contraseñas si se desea
docker compose up -d
```

- App: `http://localhost:3000`
- API / Swagger: `http://localhost:8000/docs`

### Opción B — Kubernetes (minikube)

```bash
# Requisitos: minikube + kubectl instalados
minikube start --driver=docker
minikube addons enable ingress
minikube addons enable metrics-server

./scripts/k8s-build.sh      # construye las imágenes en el daemon de minikube
./scripts/k8s-deploy.sh     # aplica todos los manifiestos y espera el rollout

minikube tunnel              # en otra terminal — expone el Ingress en localhost
# → http://localhost
```

### Opción C — Local sin Docker

```bash
# Requisitos: Python 3.13, Node 20, PostgreSQL 15, Redis 7 corriendo localmente

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # ajustar DATABASE_URL y REDIS_URL a localhost
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev                  # → http://localhost:5173
```

---

## Variables de entorno

Copiar `.env.example` a `.env` y ajustar los valores:

```env
POSTGRES_USER=voz_user
POSTGRES_PASSWORD=change_this_password
POSTGRES_DB=voz_bogota

DATABASE_URL=postgresql://voz_user:change_this_password@postgres:5432/voz_bogota
REDIS_URL=redis://redis:6379/0
SECRET_KEY=change_this_to_a_long_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ADMIN_SETUP_KEY=change_this_admin_key
APP_ENV=production
CORS_ORIGINS=http://localhost:3000
```

> En local (sin Docker) cambiar `@postgres:` por `@localhost:` en `DATABASE_URL` y `redis://redis:` por `redis://localhost:` en `REDIS_URL`.

---

## Crear primer administrador

```bash
curl -X POST "http://localhost:8000/admin/setup" \
  -H "Content-Type: application/json" \
  -H "x-admin-setup-key: TU_ADMIN_SETUP_KEY" \
  -d '{"cc":"11111111","nombre":"Admin","apellido":"Bogota","pin":"1234"}'
```

---

## Demo HPA (Kubernetes)

Para demostrar el escalado automático horizontal:

```bash
./scripts/k8s-loadtest.sh
```

El script lanza pods generadores de carga dentro del clúster y muestra cómo el backend escala de **2 a 5 réplicas** automáticamente en ~45 segundos.

---

## Documentación técnica por fase

Disponible en [`docs/`](docs/):

| Documento | Contenido |
|-----------|-----------|
| [Fase 1](docs/fase1-fundacion-local.md) | Backend FastAPI, modelos DB, JWT, Redis caché, 10 pantallas React |
| [Fase 2](docs/fase2-verificacion-integracion.md) | Verificación end-to-end y 4 bugs corregidos |
| [Fase 3](docs/fase3-dockerizacion.md) | Dockerfiles multi-stage, nginx, entrypoint.sh |
| [Fase 4](docs/fase4-docker-compose.md) | Docker Compose con health checks y volúmenes |
| [Fase 5](docs/fase5-kubernetes.md) | Manifiestos K8s: Namespace, Deployments, Services, Ingress, HPA, PVC |
| [Fase 6](docs/fase6-kubernetes-hpa.md) | Redis PVC, inventario completo K8s, demo HPA bajo carga real |

---

## Estructura del repositorio

```
voz-bogota/
├── backend/                  # FastAPI app
│   ├── app/
│   │   ├── api/routes/       # auth, surveys, responses, admin, questions
│   │   ├── core/             # config, security, redis_client
│   │   └── db/               # models, migrations (alembic)
│   ├── Dockerfile
│   └── entrypoint.sh         # wait-for-postgres + alembic upgrade head
├── frontend/                 # React + Vite SPA
│   ├── src/
│   │   ├── components/       # screens, admin, common
│   │   ├── services/api.js   # axios + JWT interceptor
│   │   └── store/            # Zustand auth store
│   ├── Dockerfile            # multi-stage: node build → nginx serve
│   └── nginx.conf
├── k8s/                      # Manifiestos Kubernetes
│   ├── namespace.yaml
│   ├── ingress.yaml
│   ├── configmaps/
│   ├── secrets/
│   ├── postgres/
│   ├── redis/
│   ├── backend/
│   └── frontend/
├── scripts/
│   ├── k8s-build.sh          # construye imágenes en minikube
│   ├── k8s-deploy.sh         # aplica manifiestos + rollout wait
│   └── k8s-loadtest.sh       # demo HPA con carga real
├── docs/                     # Documentación por fase
├── docker-compose.yml
└── .env.example
```
