# Fase 3 — Dockerización de Componentes

**Proyecto:** Voz Bogotá — Sistema de Participación Ciudadana  
**Objetivo:** Contenerizar el frontend y el backend como imágenes Docker independientes, listas para orquestarse.  
**Herramientas:** Docker · nginx:alpine · python:3.13-slim · node:20-alpine

---

## Contexto

Con la aplicación funcionando en local (Fase 1 + 2), la Fase 3 empaqueta cada servicio en un contenedor Docker reproducible. Cada imagen debe funcionar de forma idéntica en cualquier máquina, sin depender del entorno local del desarrollador.

---

## Paso 1 — Dockerfile del Frontend (multi-stage build)

**Archivo:** `frontend/Dockerfile`

```dockerfile
# Stage 1: compilar la app React con Node
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci                  # instalación reproducible (usa package-lock.json)
COPY . .
RUN npm run build           # genera /app/dist con el bundle estático

# Stage 2: servir el bundle con nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

**Por qué multi-stage:**
- La imagen final (`nginx:alpine`) solo contiene los archivos estáticos compilados
- **No incluye** Node, npm, ni el código fuente
- Tamaño final: ~63 MB (vs ~400 MB con Node incluido)

---

## Paso 2 — Configuración de nginx

**Archivo:** `frontend/nginx.conf`

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Compresión gzip para JS/CSS/JSON
    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Cabeceras de seguridad
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";

    # Proxy inverso: /api/* → backend:8000
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback: cualquier ruta desconocida → index.html (React Router)
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

**Decisiones clave:**
- `/api/` → `http://backend:8000/` con barra final (nginx elimina el prefijo `/api` antes de reenviar)
- `try_files $uri /index.html` es esencial para que React Router funcione con rutas como `/encuestas/5`
- El nombre `backend` se resuelve por DNS interno en Docker Compose / Kubernetes

---

## Paso 3 — Dockerfile del Backend

**Archivo:** `backend/Dockerfile`

```dockerfile
FROM python:3.13-slim
WORKDIR /app

# 1. Copiar dependencias primero (aprovecha caché de capas Docker)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 2. Copiar el código
COPY . .

# 3. Permisos y usuario no-root
RUN chmod +x entrypoint.sh && \
    chmod -R a+rX /app && \
    adduser --disabled-password --gecos "" appuser
USER appuser

EXPOSE 8000

# 4. Health check integrado en la imagen
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["./entrypoint.sh"]
```

**Decisiones de seguridad:**
- `chmod -R a+rX /app`: garantiza que el usuario no-root pueda leer todos los archivos copiados por root
- `adduser appuser` + `USER appuser`: el proceso corre sin privilegios (principio de mínimo privilegio)
- `HEALTHCHECK`: Docker sabe si el contenedor está realmente listo, no solo si el proceso arrancó

---

## Paso 4 — entrypoint.sh: arranque robusto

**Archivo:** `backend/entrypoint.sh`

El problema con `CMD ["uvicorn", "..."]` directamente: si PostgreSQL no está listo cuando el contenedor arranca, la app falla sin mensaje claro.

**Solución:** un script de inicio con retry loop:

```sh
#!/bin/sh
set -e

# Falla inmediatamente si DATABASE_URL no está configurada
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL no configurada. Abortando."
    exit 1
fi

echo "Esperando a PostgreSQL..."
RETRIES=30
until python -c "
import os, psycopg2
psycopg2.connect(os.environ['DATABASE_URL'])
"; do
    RETRIES=$((RETRIES - 1))
    if [ "$RETRIES" -le 0 ]; then
        echo "ERROR: PostgreSQL no respondió en 30 intentos."
        exit 1
    fi
    echo "PostgreSQL no listo — reintentando en 2s... ($RETRIES intentos restantes)"
    sleep 2
done

echo "PostgreSQL listo. Ejecutando migraciones..."
alembic upgrade head       # aplica migraciones pendientes

echo "Iniciando servidor..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
```

**Flujo de arranque garantizado:**
```
Contenedor inicia
     ↓
¿DATABASE_URL configurada? → No → exit 1 con mensaje claro
     ↓ Sí
Retry loop (máx 60s) → ¿PostgreSQL acepta conexiones?
     ↓ Sí
alembic upgrade head → migraciones al día
     ↓
exec uvicorn → servidor en producción
```

---

## Paso 5 — Archivos .dockerignore

Reducen el contexto de build (archivos que Docker no necesita copiar):

**`backend/.dockerignore`**
```
venv/
env/
.venv/
__pycache__/
*.pyc
.env
*.egg-info/
.pytest_cache/
.git/
scripts/
*.md
```

**`frontend/.dockerignore`**
```
node_modules/
dist/
.vite/
*.log
.env*
```

**Por qué importa:** sin `.dockerignore`, `node_modules/` (300+ MB) se copiaría al contexto de build en cada `docker build`.

---

## Paso 6 — Verificación de las imágenes

```bash
# Construir imágenes
docker build -t voz-backend:latest ./backend
docker build -t voz-frontend:latest ./frontend

# Verificar tamaños
docker images | grep voz
# voz-frontend   latest   ...   63MB
# voz-backend    latest   ...   202MB

# Probar backend en aislamiento
docker run --rm -p 8000:8000 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e SECRET_KEY=test \
  -e ADMIN_SETUP_KEY=test \
  voz-backend:latest

# Probar frontend en aislamiento
docker run --rm -p 3000:80 voz-frontend:latest
# → http://localhost:3000 sirve index.html
```

---

## Bugs encontrados y corregidos durante la Fase 3

### Bug: permisos de archivos en el contenedor

**Síntoma:** El contenedor del backend fallaba con `Permission denied` al intentar leer los archivos de la app.

**Causa:** Los archivos copiados con `COPY . .` (ejecutado como root) tenían permisos `700`, que el usuario `appuser` no podía leer.

**Fix:** `chmod -R a+rX /app` antes de crear el usuario no-root asigna permisos de lectura a todos (`a+r`) y de ejecución solo a directorios (`+X`).

### Bug: bcrypt faltaba en requirements.txt

**Síntoma:** El contenedor crasheaba con `ModuleNotFoundError: No module named 'bcrypt'`.

**Causa:** `security.py` importa `bcrypt` directamente, pero no estaba declarado en `requirements.txt` (funcionaba en local porque estaba instalado globalmente).

**Fix:** Se añadió `bcrypt==4.2.1` a `requirements.txt`.

---

## Resultado de la Fase 3

| Imagen | Base | Tamaño | Técnica |
|--------|------|--------|---------|
| `voz-frontend:latest` | nginx:alpine | 63 MB | Multi-stage build |
| `voz-backend:latest` | python:3.13-slim | 202 MB | Usuario no-root + HEALTHCHECK |

- Ambas imágenes construyen sin errores
- Backend espera a PostgreSQL antes de arrancar (retry loop 30 intentos)
- Migraciones Alembic se aplican automáticamente al iniciar
- nginx sirve la SPA con proxy `/api/` y SPA fallback
