# Fase 4 — Docker Compose (Orquestación Local)

**Proyecto:** Voz Bogotá — Sistema de Participación Ciudadana  
**Objetivo:** Orquestar los 4 servicios (frontend, backend, PostgreSQL, Redis) con un solo comando usando Docker Compose.  
**Herramientas:** Docker Compose v2 · postgres:15-alpine · redis:7-alpine

---

## Contexto

Con las imágenes Docker de la Fase 3 listas, la Fase 4 conecta todos los servicios en una sola red y los levanta con `docker compose up`. El objetivo es que cualquier desarrollador pueda clonar el repositorio y tener la app completa corriendo en minutos, sin instalar Python, Node ni configurar bases de datos manualmente.

---

## Paso 1 — Archivo docker-compose.yml

**Archivo:** `docker-compose.yml` (raíz del proyecto)

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -q -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
      start_period: 10s

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - app_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 5s

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    env_file: .env
    networks:
      - app_network
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://localhost:8000/health')\""]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    networks:
      - app_network
    restart: unless-stopped
    depends_on:
      backend:
        condition: service_healthy

networks:
  app_network:

volumes:
  postgres_data:
  redis_data:
```

---

## Paso 2 — Cadena de dependencias con health checks

La clave de este Compose es que los servicios no solo esperan a que el contenedor **arranque**, sino a que esté **realmente listo** para recibir peticiones.

```
postgres (healthcheck: pg_isready)
    ↓  condition: service_healthy
redis (healthcheck: redis-cli ping)
    ↓  condition: service_healthy
backend (healthcheck: GET /health)
    ↓  condition: service_healthy
frontend
```

**Por qué `condition: service_healthy` y no solo `depends_on`:**

Un contenedor puede estar "corriendo" pero aún inicializando. Sin health checks, el backend intentaría conectarse a PostgreSQL antes de que este estuviera listo, provocando un crash silencioso.

### Health checks configurados

| Servicio | Comando | Intervalo | Inicio |
|----------|---------|-----------|--------|
| postgres | `pg_isready -q -U $USER -d $DB` | 5s | 10s |
| redis | `redis-cli ping` | 5s | 5s |
| backend | `urllib.request.urlopen('/health')` | 10s | 30s |

El `start_period` da tiempo al servicio para arrancar antes de que fallen los health checks (un fallo durante el start_period no cuenta como unhealthy).

---

## Paso 3 — Variables de entorno

**Archivo:** `.env.example` (committeable — solo valores de ejemplo)

```env
# PostgreSQL
POSTGRES_USER=voz_user
POSTGRES_PASSWORD=change_this_password
POSTGRES_DB=voz_bogota

# Backend
DATABASE_URL=postgresql://voz_user:change_this_password@postgres:5432/voz_bogota
REDIS_URL=redis://redis:6379/0
SECRET_KEY=change_this_to_a_long_random_string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ADMIN_SETUP_KEY=change_this_admin_key
APP_ENV=production
CORS_ORIGINS=http://localhost:3000
```

**Nota importante:** Los hostnames en `DATABASE_URL` y `REDIS_URL` son `postgres` y `redis` (nombres de los servicios en Docker Compose), **no** `localhost`. Docker Compose crea automáticamente entradas DNS para cada servicio dentro de la red `app_network`.

El archivo `.env` real (con contraseñas reales) está en `.gitignore` y nunca se commitea.

---

## Paso 4 — Red interna `app_network`

```
┌─────────────────────────────────────────┐
│            app_network (Docker)          │
│                                          │
│  postgres:5432   redis:6379              │
│       ↑               ↑                  │
│  backend:8000 ─────────┘                 │
│       ↑                                  │
│  frontend:80                             │
└─────────────────────────────────────────┘
         ↑              ↑
    puerto 3000     puerto 8000
      (host)          (host)
```

Los servicios se comunican por nombre dentro de la red. Solo `backend` (8000) y `frontend` (3000) exponen puertos al host. PostgreSQL y Redis solo son accesibles desde dentro de Docker.

---

## Paso 5 — Volúmenes persistentes

```yaml
volumes:
  postgres_data:   # datos de PostgreSQL
  redis_data:      # datos de Redis (AOF/RDB)
```

**Comportamiento:**
- `docker compose down` → detiene contenedores, **los volúmenes persisten**
- `docker compose down -v` → elimina también los volúmenes (borra datos)
- `docker compose up` → PostgreSQL vuelve con todos los datos intactos

Sin volúmenes, la base de datos se perdería cada vez que se detiene el Compose.

---

## Paso 6 — Política de reinicio

```yaml
restart: unless-stopped
```

Si un contenedor falla (crash, OOM, error de configuración), Docker lo reinicia automáticamente. Solo no reinicia si se detiene manualmente con `docker compose stop` o `docker compose down`.

---

## Paso 7 — Secuencia de arranque completa

```bash
# 1. Copiar y configurar variables de entorno
cp .env.example .env
# editar .env con valores reales

# 2. Levantar todos los servicios
docker compose up -d

# 3. Ver estado de los servicios
docker compose ps
```

**Salida esperada:**
```
NAME            STATUS              PORTS
voz-postgres    Up (healthy)        5432/tcp
voz-redis       Up (healthy)        6379/tcp
voz-backend     Up (healthy)        0.0.0.0:8000->8000/tcp
voz-frontend    Up                  0.0.0.0:3000->80/tcp
```

**Logs en tiempo real:**
```bash
docker compose logs -f backend   # ver logs del backend
docker compose logs -f           # ver todos los servicios
```

---

## Paso 8 — Verificación end-to-end sobre Docker Compose

```bash
# Health check del backend
curl http://localhost:8000/health
# → {"status":"ok","app":"Voz Bogotá"}

# Frontend sirviendo la app
curl -I http://localhost:3000
# → HTTP/1.1 200 OK

# Caché Redis
curl -I http://localhost:8000/surveys
# → X-Cache: MISS (primera vez)
curl -I http://localhost:8000/surveys
# → X-Cache: HIT  (segunda vez)

# Flujo completo
# 1. Abrir http://localhost:3000
# 2. Registro → Login → Encuesta → Mapa
```

---

## Bugs encontrados y corregidos durante la Fase 4

### Bug: carrera de arranque (race condition) con PostgreSQL

**Síntoma:** El backend crasheaba al arrancar con `Connection refused` a PostgreSQL, aunque `depends_on` estaba configurado.

**Causa:** `depends_on` solo esperaba a que el contenedor de postgres **existiera**, no a que la base de datos estuviera lista. El health check en Compose resuelve esto a nivel de orquestador, pero el backend también necesita resiliencia interna (el health check del propio backend podría marcarlo como unhealthy antes de que postgres esté listo).

**Fix:** El `entrypoint.sh` (creado en la Fase 3) incluye un retry loop de 30 intentos con 2 segundos entre cada uno. Combinar `depends_on: condition: service_healthy` en Compose con el retry loop en el backend garantiza un arranque robusto en todas las condiciones.

### Bug: .gitignore ignoraba los archivos .dockerignore

**Síntoma:** Los archivos `backend/.dockerignore` y `frontend/.dockerignore` no aparecían en `git status` — git los estaba ignorando.

**Causa:** El `.gitignore` original tenía la línea `*.dockerignore`, que coincide con cualquier archivo que termine en `.dockerignore`.

**Fix:** Se reemplazó `*.dockerignore` por `docker-compose.override.yml` en `.gitignore`. Los archivos `.dockerignore` deben estar en git para que Docker los use consistentemente en cualquier máquina.

---

## Comandos útiles

```bash
# Levantar en primer plano (ver logs)
docker compose up

# Levantar en segundo plano
docker compose up -d

# Ver estado
docker compose ps

# Ver logs de un servicio
docker compose logs -f backend

# Reconstruir imágenes (después de cambios en código)
docker compose up --build

# Detener sin eliminar datos
docker compose down

# Detener y eliminar volúmenes (reinicio limpio)
docker compose down -v

# Ejecutar comando dentro de un contenedor
docker compose exec backend python scripts/create_admin.py
```

---

## Resultado de la Fase 4

| Comando | Resultado |
|---------|-----------|
| `docker compose up -d` | 4 servicios corriendo |
| `docker compose ps` | todos `(healthy)` |
| `curl localhost:8000/health` | `{"status":"ok"}` |
| `curl localhost:3000` | `HTTP 200` |
| `docker compose down && docker compose up -d` | datos de PostgreSQL persisten |

- Un solo archivo YAML describe toda la infraestructura
- Cualquier desarrollador puede clonar + `docker compose up` sin configuración adicional
- Health checks garantizan orden correcto de arranque
- Datos persistentes entre reinicios gracias a volúmenes nombrados
