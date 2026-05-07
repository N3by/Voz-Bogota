# Plan: Voz Bogotá — Sistema de Participación Ciudadana

## Convención de avance

**Palabra clave `"todo melo"`** → indica que la fase actual está completa y pasamos a la siguiente.
Cada fase se ejecuta en orden. No se avanza sin confirmación explícita.

---

## Contexto

Aplicación web **mobile-first** de participación ciudadana para Bogotá. Permite a ciudadanos responder encuestas geolocalizadas por localidad, y a administradores gestionar encuestas + visualizar analítica + mapa de calor. El proyecto sirve además como demostración práctica del stack completo: React → FastAPI → PostgreSQL → Redis → Docker → Kubernetes.

**Estado actual:** Proyecto vacío (greenfield). Solo existe `.claude/settings.local.json`.

### Decisiones de diseño confirmadas
- **Encuestas:** El admin tiene panel CRUD completo (crear/editar/cerrar encuestas y preguntas) desde la UI.
- **Mapa de calor:** Usa la **localidad registrada en el perfil** del ciudadano (sin GPS, sin permisos de navegador).
- **Primer admin:** Vía `POST /admin/setup` protegido por `ADMIN_SETUP_KEY` en `.env`.

---

## Paleta de Colores (Bogotá Minimalista)

```
--color-primary:    #C8102E   /* Rojo Bogotá (bandera de la ciudad) */
--color-surface:    #FFFFFF   /* Blanco */
--color-bg:         #F4F4F6   /* Gris claro fondo */
--color-text:       #1A1A2E   /* Azul noche / texto principal */
--color-muted:      #6B7280   /* Gris medio / subtítulos */
--color-success:    #2E7D32   /* Verde / confirmaciones */
--color-border:     #E5E7EB   /* Borde sutil */
```

---

## Arquitectura del Sistema

```
┌──────────────────────────────────────────────────────────┐
│  FRONTEND (React + Vite)  :3000                          │
│  SPA mobile-first · React Router · Zustand · Leaflet     │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTP / REST (axios)
┌────────────────────▼─────────────────────────────────────┐
│  BACKEND (FastAPI + Python)  :8000                        │
│  JWT Auth · OpenAPI/Swagger · SQLAlchemy ORM              │
└──────────┬──────────────────────┬────────────────────────┘
           │                      │
┌──────────▼──────┐    ┌──────────▼──────┐
│  PostgreSQL :5432│    │  Redis :6379     │
│  Datos + Modelos │    │  Sesiones/Caché  │
└─────────────────┘    └─────────────────┘
```

---

## Estructura de Carpetas (objetivo final)

```
voz-bogota/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/         # BottomNav, PinInput, ProgressBar, Modal
│   │   │   ├── screens/        # Una carpeta por pantalla
│   │   │   └── admin/          # Charts, HeatMapAdmin
│   │   ├── services/           # api.js, authService.js, surveyService.js
│   │   ├── store/              # authStore.js (Zustand)
│   │   ├── styles/             # variables.css, global.css
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
├── backend/
│   ├── app/
│   │   ├── api/routes/         # auth.py, surveys.py, responses.py, admin.py
│   │   ├── core/               # config.py, security.py, redis_client.py
│   │   ├── db/                 # database.py, models.py
│   │   ├── schemas/            # user.py, survey.py, response.py
│   │   └── main.py
│   ├── alembic/                # Migraciones DB
│   ├── requirements.txt
│   └── .env.example
├── k8s/                        # Fase 5-6
│   ├── namespace.yaml
│   ├── frontend/
│   ├── backend/
│   ├── postgres/
│   └── redis/
├── docker-compose.yml          # Fase 4
├── plan.md                     # Este archivo
├── .gitignore
└── README.md
```

---

## Modelos de Base de Datos

```sql
-- Usuarios
users: id, cc, nombre, apellido, telefono, localidad_id, pin_hash, rol (ciudadano|admin), created_at

-- Localidades de Bogotá (20 localidades, seed data)
localidades: id, nombre, codigo, lat_centro, lng_centro

-- Encuestas
surveys: id, titulo, descripcion, categoria, estado (activa|cerrada), duracion_min, created_by, created_at

-- Preguntas
questions: id, survey_id, texto, tipo (opcion_multiple|escala|texto_libre), orden

-- Opciones de respuesta
options: id, question_id, texto, valor

-- Registro de participación
responses: id, user_id, survey_id, localidad_id, created_at

-- Respuestas detalle
response_answers: id, response_id, question_id, option_id, texto_libre
```

---

## Pantallas y Flujos MVP

### Pantallas (navegación Bottom Nav)

| # | Pantalla | Rol | Descripción |
|---|----------|-----|-------------|
| 0 | Splash   | público | Logo, 3 features, "Comenzar" + "Ya tengo cuenta" |
| — | Login    | público | CC + PIN 4 dígitos. Link "¿Olvidaste PIN?" + "Crear cuenta" |
| — | Registro | público | 3 pasos: datos → contacto+localidad → crear PIN |
| 1 | Encuestas | ciudadano | Selector de encuestas activas (duración + participantes) |
| 1b | Encuesta | ciudadano | Responder encuesta + modal post-encuesta (countdown 5s) |
| 2 | Mapa     | ciudadano | Bogotá + mapa de calor por localidad (Leaflet) |
| 3 | Perfil/Ajustes | ciudadano | Datos del usuario, cerrar sesión |
| — | Dashboard Admin | admin | KPIs + gráficas (Recharts) + mapa de calor |
| — | Admin Encuestas | admin | CRUD completo de encuestas y preguntas |

---

## Dependencias Clave

### Frontend
```json
{
  "react": "^18", "react-dom": "^18",
  "react-router-dom": "^6",
  "zustand": "^4",
  "axios": "^1",
  "leaflet": "^1", "leaflet.heat": "^0.2",
  "recharts": "^2"
}
```

### Backend
```
fastapi, uvicorn[standard]
sqlalchemy, alembic, psycopg2-binary
redis, python-jose[cryptography], passlib[bcrypt]
python-dotenv, pydantic-settings
```

---

## FASES DE DESARROLLO

---

### FASE 1 — Fundación Local (Prioridad: Core funcional)

**Objetivo:** Aplicación corriendo 100% en local sin Docker.

**Estado:** 🔄 En progreso

#### 1.1 Setup del proyecto
- [ ] `git init` + `.gitignore` + README inicial
- [ ] Crear `frontend/` con Vite: `npm create vite@latest frontend -- --template react`
- [ ] Crear `backend/` con estructura FastAPI + `requirements.txt`
- [ ] Crear `backend/.env.example` con todas las variables necesarias

#### 1.2 Backend — Base
- [ ] `app/main.py`: FastAPI app con CORS configurado
- [ ] `app/core/config.py`: Settings con pydantic-settings (DATABASE_URL, REDIS_URL, SECRET_KEY, etc.)
- [ ] `app/db/database.py`: SQLAlchemy engine + SessionLocal
- [ ] `app/db/models.py`: Todos los modelos ORM (users, surveys, questions, options, responses, response_answers, localidades)
- [ ] Alembic init + primera migración
- [ ] Seed data: 20 localidades de Bogotá

#### 1.3 Backend — Auth
- [ ] `app/core/security.py`: hash_pin(), verify_pin(), create_access_token(), decode_token()
- [ ] `app/api/deps.py`: get_current_user() dependency
- [ ] `app/api/routes/auth.py`:
  - `POST /auth/register` — registro 3 pasos (validar CC único)
  - `POST /auth/login` — CC + PIN → JWT
  - `GET /auth/me` — perfil del usuario autenticado

#### 1.4 Backend — Encuestas y Respuestas
- [ ] `app/api/routes/surveys.py`:
  - `GET /surveys` — listar encuestas activas (con contador de participantes)
  - `GET /surveys/{id}` — detalle + preguntas + opciones
- [ ] `app/api/routes/responses.py`:
  - `POST /responses` — guardar respuesta completa (idempotente: 1 respuesta por user/survey)
- [ ] `app/api/routes/admin.py` (requiere rol admin):
  - `POST /admin/setup` — crea primer admin (requiere ADMIN_SETUP_KEY en header)
  - `GET /admin/stats` — KPIs generales
  - `GET /admin/heatmap` — datos agrupados por localidad para mapa de calor
  - `GET /admin/surveys/{id}/analytics` — analítica por encuesta
  - `POST /surveys` — crear nueva encuesta con preguntas y opciones
  - `PUT /surveys/{id}` — editar encuesta
  - `PATCH /surveys/{id}/status` — cambiar estado (activa/cerrada)
  - `POST /surveys/{id}/questions` — agregar pregunta
  - `PUT /questions/{id}` — editar pregunta
  - `DELETE /questions/{id}` — eliminar pregunta

#### 1.5 Backend — Redis
- [ ] `app/core/redis_client.py`: conexión Redis
- [ ] Cache en `GET /surveys` (TTL 60s)
- [ ] Invalidar cache al crear nueva respuesta

#### 1.6 Frontend — Design System
- [ ] `src/styles/variables.css`: todas las custom properties de color y tipografía
- [ ] `src/styles/global.css`: reset, base, utilidades
- [ ] Componente `PinInput.jsx`: 4 puntos visuales + input único oculto
- [ ] Componente `ProgressBar.jsx`: barra de pasos animada
- [ ] Componente `BottomNav.jsx`: navegación inferior 3 tabs (Encuestas, Mapa, Perfil)
- [ ] Componente `Modal.jsx`: modal genérico reutilizable

#### 1.7 Frontend — Pantallas de Auth
- [ ] `SplashScreen.jsx`: Logo, 3 features, botones "Comenzar" / "Ya tengo cuenta"
- [ ] `LoginScreen.jsx`: Campo CC + PinInput + links "¿Olvidaste tu PIN?" / "Crear cuenta →"
- [ ] `RegisterScreen.jsx`: 3 pasos con ProgressBar
  - Paso 1: nombre, apellido, CC
  - Paso 2: teléfono, localidad (select con 20 localidades)
  - Paso 3: crear PIN (PinInput x2 para confirmar)

#### 1.8 Frontend — Pantallas principales
- [ ] `SurveySelector.jsx`: lista de encuestas activas con duración estimada + badge de participantes
- [ ] `SurveyScreen.jsx`: preguntas una a una con progreso + `PostSurveyModal` al terminar
- [ ] `PostSurveyModal.jsx`: countdown 5s con barra animada + botón "Ver mapa ahora →"
- [ ] `MapScreen.jsx`: mapa Leaflet centrado en Bogotá + capa leaflet.heat con datos por localidad
- [ ] `SettingsScreen.jsx`: datos del perfil + botón cerrar sesión

#### 1.9 Frontend — Admin
- [ ] `AdminDashboard.jsx`: KPIs en cards + gráficas Recharts (barras por localidad, pastel por categoría) + mapa de calor
- [ ] `AdminSurveys.jsx`: listado de encuestas con botones crear/editar/cerrar
- [ ] `SurveyForm.jsx`: formulario para crear/editar encuesta (título, descripción, categoría, duración estimada)
- [ ] `QuestionsEditor.jsx`: agregar/reordenar/eliminar preguntas y sus opciones dentro de una encuesta

#### 1.10 Frontend — Servicios y Estado
- [ ] `src/services/api.js`: instancia axios con interceptor de JWT
- [ ] `src/store/authStore.js`: Zustand store (user, token, login, logout)
- [ ] `src/App.jsx`: React Router — rutas protegidas por rol, redirección según estado auth

---

### FASE 2 — Verificación de Integración

**Estado:** ⏳ Pendiente (espera "todo melo" en Fase 1)

#### Checklist de integración
- [ ] Frontend consume `GET /surveys` y renderiza correctamente
- [ ] Flujo completo: Registro → Login → Seleccionar encuesta → Responder → Ver mapa
- [ ] JWT: token válido requerido en rutas protegidas, 401 si expira
- [ ] PostgreSQL: datos persisten entre reinicios del servidor
- [ ] Redis: cache funciona (`X-Cache: HIT` en headers de respuesta)
- [ ] Swagger UI accesible en `http://localhost:8000/docs` con todos los endpoints documentados
- [ ] Variables de entorno: ningún secret hardcodeado, todo desde `.env`
- [ ] Admin: solo usuarios con rol `admin` acceden al dashboard (403 si ciudadano)
- [ ] Mapa de calor: datos reales de respuestas agrupados por localidad se visualizan correctamente

---

### FASE 3 — Dockerización de Componentes

**Estado:** ⏳ Pendiente (espera "todo melo" en Fase 2)

#### 3.1 Dockerfile Frontend
```dockerfile
# frontend/Dockerfile
# Stage 1: build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

#### 3.2 Dockerfile Backend
```dockerfile
# backend/Dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### 3.3 Archivos adicionales
- [ ] `frontend/nginx.conf`: proxy `/api` → backend, SPA fallback a `index.html`
- [ ] `.dockerignore` para frontend y backend
- [ ] Variables de entorno pasadas como build args o env vars en runtime

---

### FASE 4 — Docker Compose (Orquestación Local)

**Estado:** ⏳ Pendiente (espera "todo melo" en Fase 3)

#### docker-compose.yml (estructura)
```yaml
services:
  frontend:
    build: ./frontend
    ports: ["3000:80"]
    depends_on: [backend]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
    depends_on: [postgres, redis]

  postgres:
    image: postgres:15-alpine
    volumes: [postgres_data:/var/lib/postgresql/data]
    env_file: .env

  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]

volumes:
  postgres_data:
  redis_data:
```

#### Checklist Fase 4
- [ ] `docker compose up -d` levanta los 4 servicios sin errores
- [ ] Redes internas: backend accede a postgres/redis por nombre de servicio
- [ ] Volúmenes: datos persisten entre `docker compose down` + `docker compose up`
- [ ] Variables de entorno: un solo `.env` en raíz las distribuye
- [ ] Migraciones automáticas al arrancar el backend (`alembic upgrade head` como entrypoint)
- [ ] Seed de localidades ejecutado automáticamente si tabla vacía
- [ ] Flujo completo verificado sobre Docker Compose

---

### FASE 5 — Migración a Kubernetes (minikube)

**Estado:** ⏳ Pendiente (espera "todo melo" en Fase 4)

#### Setup
- [ ] `minikube start`
- [ ] Habilitar addons: `minikube addons enable ingress metrics-server`
- [ ] Push de imágenes al registry de minikube: `eval $(minikube docker-env)`

#### Manifiestos a crear en `k8s/`
```
k8s/
├── namespace.yaml              # namespace: voz-bogota
├── configmaps/
│   ├── backend-config.yaml     # Variables no sensibles (DB_HOST, REDIS_HOST, etc.)
│   └── frontend-config.yaml
├── secrets/
│   ├── db-secret.yaml          # POSTGRES_PASSWORD, SECRET_KEY (base64)
│   └── backend-secret.yaml
├── postgres/
│   ├── pv.yaml                 # PersistentVolume
│   ├── pvc.yaml                # PersistentVolumeClaim
│   ├── deployment.yaml
│   └── service.yaml            # ClusterIP
├── redis/
│   ├── deployment.yaml
│   └── service.yaml
├── backend/
│   ├── deployment.yaml         # 2 replicas
│   ├── service.yaml            # ClusterIP
│   └── hpa.yaml                # HPA: min 2, max 5, CPU 70%
├── frontend/
│   ├── deployment.yaml         # 2 replicas
│   ├── service.yaml            # ClusterIP
│   └── hpa.yaml
└── ingress.yaml                # Enruta / → frontend, /api → backend
```

---

### FASE 6 — Kubernetes Completo con HPA

**Estado:** ⏳ Pendiente (espera "todo melo" en Fase 5)

#### Componentes a demostrar

| Componente K8s | Usado en |
|----------------|----------|
| Namespace | `voz-bogota` |
| Pod | Unidad base de cada servicio |
| Deployment | Frontend, Backend, Redis, PostgreSQL |
| Service (ClusterIP) | Comunicación interna entre servicios |
| Ingress | Punto de entrada único al cluster |
| ConfigMap | Variables de entorno no sensibles |
| Secret | Passwords y claves JWT |
| PersistentVolume + PVC | PostgreSQL y Redis data |
| ReplicaSet | Gestionado por cada Deployment |
| HPA | Backend (escala según CPU), Frontend |

#### Verificación Fase 6
- [ ] `kubectl get all -n voz-bogota` muestra todos los recursos saludables
- [ ] `kubectl get hpa -n voz-bogota` muestra HPA activo
- [ ] `minikube service frontend -n voz-bogota` abre la app en el browser
- [ ] Simular carga con `ab` o `k6` para triggear HPA
- [ ] `kubectl get pods -n voz-bogota -w` muestra scaling automático

---

## Archivos Críticos a Crear (por orden)

1. `.gitignore` (raíz)
2. `backend/.env.example`
3. `backend/requirements.txt`
4. `backend/app/main.py`
5. `backend/app/core/config.py`
6. `backend/app/db/models.py`
7. `backend/app/core/security.py`
8. `backend/app/api/routes/auth.py`
9. `backend/app/api/routes/surveys.py`
10. `backend/app/api/routes/responses.py`
11. `backend/app/api/routes/admin.py`
12. `frontend/package.json` (via Vite)
13. `frontend/src/styles/variables.css`
14. `frontend/src/components/common/*.jsx`
15. `frontend/src/components/screens/*.jsx`
16. `frontend/src/store/authStore.js`
17. `frontend/src/App.jsx`

---

## Comandos de Arranque Local (Fase 1)

```bash
# Backend
cd backend
python -m venv venv && venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev
```

---

## Verificación End-to-End

1. Abrir `http://localhost:3000` → Splash screen con colores rojo/blanco Bogotá
2. "Comenzar" → Registro 3 pasos → Login con CC + PIN
3. Seleccionar encuesta activa → Responder → Modal con countdown → "Ver mapa ahora"
4. Mapa muestra calor en las localidades con más respuestas
5. Login como admin → Dashboard con KPIs + gráficas + mapa de calor
6. `http://localhost:8000/docs` → Swagger UI con todos los endpoints documentados
