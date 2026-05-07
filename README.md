# Voz Bogotá

Sistema de participación ciudadana para Bogotá. Aplicación web mobile-first que permite a los ciudadanos responder encuestas sobre su comunidad y visualizar los resultados en un mapa de calor por localidad.

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| Frontend | React 18 + Vite + Zustand + Leaflet + Recharts |
| Backend | Python + FastAPI + SQLAlchemy + JWT |
| Base de datos | PostgreSQL |
| Caché | Redis |
| DevOps | Docker + Kubernetes (próximas fases) |

## Requisitos previos (Fase 1 — Local)

- Python 3.11+
- Node.js 20+
- PostgreSQL 15 corriendo localmente
- Redis corriendo localmente

## Arranque local

### 1. Backend

```bash
cd backend

# Crear entorno virtual
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/Mac

# Instalar dependencias
pip install -r requirements.txt

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de PostgreSQL y Redis

# Ejecutar migraciones (solo primera vez o cambios de modelo)
# alembic upgrade head

# Levantar servidor
uvicorn app.main:app --reload --port 8000
```

El servidor arranca en `http://localhost:8000`  
Swagger UI: `http://localhost:8000/docs`

### 2. Frontend

```bash
cd frontend

# Instalar dependencias
npm install

# Levantar servidor de desarrollo
npm run dev
```

La app arranca en `http://localhost:3000`

### 3. Crear primer administrador

```bash
curl -X POST "http://localhost:8000/admin/setup?cc=1000000001&nombre=Admin&apellido=Bogota&pin=1234" \
  -H "x-admin-setup-key: TU_ADMIN_SETUP_KEY_DEL_ENV"
```

## Variables de entorno (backend/.env)

```env
DATABASE_URL=postgresql://usuario:password@localhost:5432/voz_bogota
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=clave_muy_larga_y_aleatoria
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
ADMIN_SETUP_KEY=clave_para_crear_admin
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Fases de desarrollo

| Fase | Descripción | Estado |
|------|-------------|--------|
| 1 | Aplicación local completa | 🔄 En progreso |
| 2 | Verificación de integración | ⏳ Pendiente |
| 3 | Dockerización por componente | ⏳ Pendiente |
| 4 | Docker Compose | ⏳ Pendiente |
| 5 | Migración a Kubernetes | ⏳ Pendiente |
| 6 | Kubernetes completo con HPA | ⏳ Pendiente |

Ver [plan.md](plan.md) para el detalle completo.
