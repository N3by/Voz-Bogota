# Fase 1 — Fundación Local

**Proyecto:** Voz Bogotá — Sistema de Participación Ciudadana  
**Objetivo:** Construir el MVP completo corriendo 100% en local sin Docker.  
**Stack:** React 18 + Vite · FastAPI · PostgreSQL 15 · Redis 7 · Python 3.13

---

## Contexto

Voz Bogotá es una aplicación web **mobile-first** que permite a los ciudadanos responder encuestas geolocalizadas por localidad, y a los administradores gestionar encuestas y visualizar analítica en tiempo real. La Fase 1 construye todo desde cero: backend, frontend y base de datos, funcionando en el entorno local del desarrollador.

---

## Arquitectura del sistema

```
┌──────────────────────────────────────────────┐
│  FRONTEND (React + Vite)  :3000              │
│  SPA mobile-first · React Router · Zustand   │
└────────────────────┬─────────────────────────┘
                     │ HTTP REST (axios /api)
┌────────────────────▼─────────────────────────┐
│  BACKEND (FastAPI)  :8000                     │
│  JWT Auth · OpenAPI · SQLAlchemy ORM          │
└──────────┬──────────────────────┬────────────┘
           │                      │
┌──────────▼──────┐    ┌──────────▼──────┐
│  PostgreSQL :5432│    │  Redis :6379     │
│  Datos + Modelos │    │  Caché TTL 60s   │
└─────────────────┘    └─────────────────┘
```

---

## Paso 1 — Inicialización del repositorio

```bash
git init
```

Se creó el archivo `.gitignore` con exclusiones para:
- Python: `__pycache__/`, `venv/`, `*.pyc`, `.pytest_cache/`
- Node: `node_modules/`, `frontend/dist/`
- Entorno: `.env`, `*.env.local`
- IDE: `.vscode/`, `.idea/`, `.DS_Store`
- Kubernetes secrets: `k8s/secrets/*.yaml`

---

## Paso 2 — Estructura del proyecto

```
voz-bogota/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── deps.py          # Dependencias de inyección (auth)
│   │   │   └── routes/
│   │   │       ├── auth.py
│   │   │       ├── surveys.py
│   │   │       ├── responses.py
│   │   │       ├── questions.py
│   │   │       └── admin.py
│   │   ├── core/
│   │   │   ├── config.py        # Settings con pydantic-settings
│   │   │   ├── security.py      # JWT + bcrypt
│   │   │   └── redis_client.py  # Caché Redis
│   │   ├── db/
│   │   │   ├── database.py      # SQLAlchemy engine + SessionLocal
│   │   │   ├── models.py        # Todos los modelos ORM
│   │   │   └── seed.py          # 20 localidades de Bogotá
│   │   └── main.py
│   ├── alembic/                 # Migraciones de base de datos
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── common/          # BottomNav, PinInput, ProgressBar, Modal
    │   │   ├── screens/         # Una pantalla por archivo
    │   │   └── admin/           # Panel de administración
    │   ├── services/
    │   │   └── api.js           # Instancia axios con interceptor JWT
    │   ├── store/
    │   │   └── authStore.js     # Estado global con Zustand
    │   ├── styles/
    │   │   ├── variables.css    # Design tokens (colores, tipografía)
    │   │   └── global.css       # Reset + utilidades
    │   └── App.jsx              # Router principal
    ├── package.json
    └── vite.config.js
```

---

## Paso 3 — Backend: configuración base

### `backend/app/core/config.py`

Usa **pydantic-settings** para leer las variables de entorno con tipado estricto:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    ADMIN_SETUP_KEY: str
    CORS_ORIGINS: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}
```

### `backend/app/db/database.py`

Configura el engine de SQLAlchemy y el patrón de sesión por request:

```python
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

## Paso 4 — Modelos de base de datos

**Archivo:** `backend/app/db/models.py`

Se definieron 7 modelos ORM con SQLAlchemy:

| Modelo | Tabla | Descripción |
|--------|-------|-------------|
| `User` | `users` | CC, nombre, PIN hasheado, rol (ciudadano/admin) |
| `Localidad` | `localidades` | 20 localidades de Bogotá con coordenadas |
| `Survey` | `surveys` | Encuestas con estado activa/cerrada |
| `Question` | `questions` | Preguntas (opción múltiple, escala) |
| `Option` | `options` | Opciones de respuesta |
| `Response` | `responses` | Registro de participación por usuario/encuesta |
| `ResponseAnswer` | `response_answers` | Respuesta detallada por pregunta |

```sql
-- Modelo de datos simplificado
users:           id, cc, nombre, apellido, telefono, localidad_id, pin_hash, rol
localidades:     id, nombre, codigo, lat_centro, lng_centro
surveys:         id, titulo, descripcion, categoria, estado, duracion_min, created_by
questions:       id, survey_id, texto, tipo, orden
options:         id, question_id, texto, valor
responses:       id, user_id, survey_id, localidad_id, created_at
response_answers: id, response_id, question_id, option_id, texto_libre
```

### Migraciones con Alembic

```bash
alembic init alembic
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

Alembic genera el SQL de creación de tablas a partir de los modelos ORM y lo aplica a PostgreSQL.

### Seed data

Al arrancar la app, se ejecuta automáticamente la función `seed_localidades()` que inserta las 20 localidades de Bogotá si la tabla está vacía.

---

## Paso 5 — Seguridad: JWT + bcrypt

**Archivo:** `backend/app/core/security.py`

```python
import bcrypt, jwt

def hash_pin(pin: str) -> str:
    return bcrypt.hashpw(pin.encode(), bcrypt.gensalt()).decode()

def verify_pin(pin: str, hashed: str) -> bool:
    return bcrypt.checkpw(pin.encode(), hashed.encode())

def create_access_token(data: dict) -> str:
    payload = {**data, "exp": datetime.now(UTC) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
```

**Decisiones:**
- Los PINs se hashean con **bcrypt** (no reversible, salt aleatorio)
- Los tokens JWT se firman con `HS256` y expiran en 60 minutos
- `HTTPBearer(auto_error=False)` en `deps.py` garantiza que rutas sin token devuelvan **401** (no 403)

---

## Paso 6 — API REST: endpoints

### Auth — `POST /auth/register`

Registro en un solo request con validación de CC único:

```json
{
  "cc": "12345678",
  "nombre": "Juan",
  "apellido": "García",
  "telefono": "3001234567",
  "localidad_id": 8,
  "pin": "1234"
}
```

Responde con `{ "access_token": "...", "user": {...} }`.

### Auth — `POST /auth/login`

```json
{ "cc": "12345678", "pin": "1234" }
```

### Encuestas — `GET /surveys`

- Lista encuestas activas con conteo de participantes
- Cache Redis TTL 60s
- Retorna header `X-Cache: HIT` o `X-Cache: MISS`
- Parámetro opcional `?include_closed=true` para el panel admin

### Respuestas — `POST /responses`

Idempotente: un usuario solo puede responder una encuesta una vez. Si intenta responder de nuevo, recibe error 400.

### Admin — `POST /admin/setup`

Crea el primer usuario administrador. Requiere la cabecera:
```
X-Setup-Key: <ADMIN_SETUP_KEY del .env>
```

### Admin — `GET /admin/stats`

```json
{
  "total_usuarios": 42,
  "total_encuestas": 5,
  "encuestas_activas": 3,
  "total_participaciones": 128,
  "participaciones_por_localidad": [...]
}
```

---

## Paso 7 — Caché Redis

**Archivo:** `backend/app/core/redis_client.py`

```python
redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)

def get_cache(key): return redis_client.get(key)
def set_cache(key, value, ttl=60): redis_client.setex(key, ttl, value)
def delete_pattern(pattern):
    keys = redis_client.keys(pattern)
    if keys: redis_client.delete(*keys)
```

**Flujo de caché:**
1. `GET /surveys` → busca en Redis con clave `surveys:list`
2. Si existe → responde con `X-Cache: HIT`, sin tocar PostgreSQL
3. Si no existe → consulta DB, guarda en Redis con TTL 60s, responde `X-Cache: MISS`
4. `POST /responses` → invalida la clave de caché para reflejar el nuevo conteo

---

## Paso 8 — Frontend: design system

**Paleta de colores** inspirada en la identidad visual de Bogotá:

```css
--color-primary:  #C8102E;  /* Rojo Bogotá */
--color-surface:  #FFFFFF;
--color-bg:       #F4F4F6;
--color-text:     #1A1A2E;  /* Azul noche */
--color-muted:    #6B7280;
--color-success:  #2E7D32;
--color-border:   #E5E7EB;
```

**Componentes comunes creados:**

| Componente | Descripción |
|---|---|
| `PinInput.jsx` | 4 puntos visuales + input oculto, simula teclado numérico |
| `ProgressBar.jsx` | Barra de progreso animada para el registro multi-paso |
| `BottomNav.jsx` | Navegación inferior con 3 tabs: Encuestas · Mapa · Perfil |
| `Modal.jsx` | Modal genérico con backdrop y animación |

---

## Paso 9 — Frontend: pantallas

### Flujo de autenticación

```
SplashScreen → LoginScreen → (token) → SurveySelector
                           ↓
                     RegisterScreen (3 pasos)
                       Paso 1: Nombre + Apellido + CC
                       Paso 2: Teléfono + Localidad
                       Paso 3: PIN × 2 (confirmación)
```

### Flujo ciudadano

```
SurveySelector → SurveyScreen → PostSurveyModal → MapScreen
```

- **SurveySelector:** Lista de encuestas con duración estimada y badge de participantes
- **SurveyScreen:** Pregunta a pregunta con barra de progreso. Soporta tipo `opcion_multiple` y `escala` (1–5)
- **PostSurveyModal:** Countdown de 5 segundos con barra animada, luego redirige al mapa
- **MapScreen:** Mapa Leaflet centrado en Bogotá + capa de calor `leaflet.heat` coloreada por intensidad de participación

### Panel de administración

| Componente | Función |
|---|---|
| `AdminDashboard` | KPIs (usuarios, encuestas, participaciones) + barras por localidad + pastel por categoría + mapa de calor |
| `AdminSurveys` | Listado CRUD: crear, editar, activar/cerrar encuestas |
| `SurveyForm` | Formulario de creación/edición con título, categoría y duración |
| `QuestionsEditor` | Agregar, editar y eliminar preguntas dentro de una encuesta |
| `AdminNav` | Barra de navegación inferior exclusiva del admin |

---

## Paso 10 — Estado global y cliente HTTP

### `src/store/authStore.js` — Zustand

```javascript
export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('voz_user')),
  token: localStorage.getItem('voz_token'),

  login: (user, token) => {
    localStorage.setItem('voz_user', JSON.stringify(user))
    localStorage.setItem('voz_token', token)
    set({ user, token })
  },

  logout: () => {
    localStorage.removeItem('voz_user')
    localStorage.removeItem('voz_token')
    set({ user: null, token: null })
  },
}))
```

**Por qué Zustand:** API mínima, sin boilerplate, persiste en localStorage para sobrevivir recargas.

### `src/services/api.js` — Axios

```javascript
const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('voz_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(null, (err) => {
  if (err.response?.status === 401) {
    localStorage.removeItem('voz_token')
    window.location.href = '/login'
  }
  return Promise.reject(err)
})
```

El interceptor de respuesta maneja el **logout automático** cuando el token expira.

---

## Paso 11 — React Router y rutas protegidas

**Archivo:** `src/App.jsx`

```jsx
function RequireAuth({ children }) {
  const { user, token } = useAuthStore()
  if (!user || !token) return <Navigate to="/login" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user } = useAuthStore()
  if (!user || user.rol !== 'admin') return <Navigate to="/encuestas" replace />
  return children
}
```

| Ruta | Acceso | Componente |
|---|---|---|
| `/` | Público | SplashScreen |
| `/login` | Público | LoginScreen |
| `/registro` | Público | RegisterScreen |
| `/encuestas` | Ciudadano | SurveySelector |
| `/encuestas/:id` | Ciudadano | SurveyScreen |
| `/mapa` | Ciudadano | MapScreen |
| `/perfil` | Ciudadano | SettingsScreen |
| `/admin` | Admin | AdminDashboard |
| `/admin/encuestas` | Admin | AdminSurveys |
| `/admin/encuestas/nueva` | Admin | SurveyForm |
| `/admin/encuestas/:id/editar` | Admin | SurveyForm |

---

## Paso 12 — Arranque local

```bash
# PostgreSQL y Redis corriendo localmente

# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # configurar DATABASE_URL, REDIS_URL, SECRET_KEY...
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend (otra terminal)
cd frontend
npm install
npm run dev            # → http://localhost:5173
```

---

## Resultado de la Fase 1

- API REST con **13 endpoints** documentados en Swagger (`http://localhost:8000/docs`)
- Autenticación JWT completa (registro, login, rutas protegidas)
- Caché Redis funcional con invalidación automática
- SPA React con **10 pantallas** y navegación por roles
- Base de datos PostgreSQL con **7 tablas** y seed automático de localidades
- Flujo ciudadano completo: Registro → Login → Encuesta → Mapa
- Panel admin completo: Dashboard → CRUD encuestas → Editor de preguntas
