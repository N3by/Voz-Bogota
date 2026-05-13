# Fase 2 — Verificación de Integración

**Proyecto:** Voz Bogotá — Sistema de Participación Ciudadana  
**Objetivo:** Verificar que todos los componentes de la Fase 1 funcionan correctamente de extremo a extremo, y corregir los bugs encontrados.

---

## Contexto

Con el MVP de la Fase 1 construido, la Fase 2 se centró en probar el sistema de forma integral: frontend consumiendo el backend real, autenticación con tokens reales, persistencia de datos en PostgreSQL y funcionamiento del caché Redis. Se encontraron y corrigieron **4 bugs** concretos.

---

## Checklist de verificación

| Área | Verificación | Resultado |
|------|-------------|-----------|
| Frontend → Backend | `GET /surveys` renderiza en la UI | ✅ |
| Flujo completo | Registro → Login → Encuesta → Mapa | ✅ con bugs corregidos |
| JWT | Token requerido en rutas protegidas | ✅ |
| JWT | 401 correcto si token expira o falta | ✅ después de fix |
| PostgreSQL | Datos persisten entre reinicios | ✅ |
| Redis | `X-Cache: HIT` en segunda petición | ✅ |
| Swagger | `http://localhost:8000/docs` funcional | ✅ |
| Admin | Solo rol `admin` accede al dashboard | ✅ |
| Mapa de calor | Datos reales por localidad visibles | ✅ |

---

## Bug 1 — JWT devolvía 403 en lugar de 401 con token ausente

**Síntoma:** Al hacer una petición sin cabecera `Authorization`, el backend respondía con HTTP `403 Forbidden` en vez de `401 Unauthorized`.

**Causa raíz:** FastAPI's `HTTPBearer()` tiene `auto_error=True` por defecto. Cuando no encuentra la cabecera, lanza automáticamente un `403`, sin pasar por la lógica del endpoint.

**Archivo:** `backend/app/api/deps.py`

```python
# ANTES — generaba 403 automáticamente si faltaba el header
bearer_scheme = HTTPBearer()

# DESPUÉS — devuelve None cuando falta el header, permitiendo
# que nuestra lógica responda 401 explícitamente
bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="Token requerido")
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(status_code=401, detail="Token inválido o expirado")
    # ...
```

**Impacto:** El frontend intercepta respuestas `401` para hacer logout automático. Con `403`, el interceptor no actuaba y el usuario quedaba atrapado en un estado inconsistente.

---

## Bug 2 — Error al enviar respuesta de encuesta tipo "escala"

**Síntoma:** Al responder una pregunta de tipo escala (1–5), el frontend mostraba "Error al enviar la respuesta".

**Causa raíz:** El frontend enviaba `{ option_id: 3 }` para una respuesta de escala, pero `option_id` es una **clave foránea** a la tabla `options`. Las preguntas de tipo escala no tienen filas en `options`, por lo que la FK fallaba en PostgreSQL.

**Archivo:** `frontend/src/components/screens/SurveyScreen.jsx`

```jsx
// ANTES — intentaba guardar como opción (FK inválida para escalas)
const selectScale = (val) => setAnswers(prev => ({
  ...prev,
  [question.id]: { option_id: val }
}))

// DESPUÉS — guarda como texto libre (no requiere FK)
const selectScale = (val) => setAnswers(prev => ({
  ...prev,
  [question.id]: { texto_libre: String(val) }
}))
```

También se corrigió la validación de "puede continuar" y el estado visual del botón seleccionado:

```jsx
// Validación canContinue para escala
if (question.tipo === 'escala') return ans.texto_libre != null

// Estado visual del botón seleccionado
className={answers[question.id]?.texto_libre === String(n) ? 'selected' : ''}
```

---

## Bug 3 — SettingsScreen mostraba "Localidad #8" en lugar del nombre

**Síntoma:** La pantalla de perfil mostraba el ID numérico de la localidad en lugar del nombre ("Localidad #8" en vez de "Kennedy").

**Causa raíz:** `SettingsScreen.jsx` accedía directamente a `user.localidad_id` sin resolver el nombre, y `RegisterScreen.jsx` tenía el array de localidades definido localmente (no era reutilizable).

**Solución:** Se extrajo el array de localidades a un módulo compartido:

**Archivo nuevo:** `frontend/src/constants/localidades.js`
```javascript
export const LOCALIDADES = [
  { id: 1, nombre: 'Usaquén' },
  { id: 2, nombre: 'Chapinero' },
  // ... 20 localidades
]
```

**Archivo:** `frontend/src/components/screens/SettingsScreen.jsx`
```jsx
import { LOCALIDADES } from '../../constants/localidades'

// ANTES
<p>Localidad #{user.localidad_id}</p>

// DESPUÉS
<p>{LOCALIDADES.find((l) => l.id === user.localidad_id)?.nombre ?? 'No especificada'}</p>
```

---

## Bug 4 — Panel admin sin navegación ni logout

**Síntoma:** Una vez dentro del panel admin, no había forma de navegar entre Dashboard y Encuestas, ni botón para cerrar sesión. El `BottomNav` ciudadano estaba oculto (correctamente), pero no había reemplazo para admin.

**Solución:** Se creó `AdminNav.jsx`, una barra de navegación inferior exclusiva para administradores:

**Archivo nuevo:** `frontend/src/components/admin/AdminNav.jsx`
```jsx
export default function AdminNav() {
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  return (
    <nav className="admin-nav">
      <NavLink to="/admin" className={...}>Dashboard</NavLink>
      <NavLink to="/admin/encuestas" className={...}>Encuestas</NavLink>
      <button onClick={() => { logout(); navigate('/') }}>Salir</button>
    </nav>
  )
}
```

**Archivo:** `frontend/src/App.jsx`
```jsx
const ADMIN_NAV_PATHS = ['/admin', '/admin/encuestas']
const showAdminNav = ADMIN_NAV_PATHS.includes(location.pathname)
// ...
{showAdminNav && <AdminNav />}
```

---

## Verificación del caché Redis

Se verificó el funcionamiento del caché con herramientas de desarrollo del navegador:

```bash
# Primera petición — sin caché
GET /api/surveys
→ X-Cache: MISS   (consulta PostgreSQL, guarda en Redis TTL 60s)

# Segunda petición (dentro de los 60s)
GET /api/surveys
→ X-Cache: HIT    (responde desde Redis, no toca PostgreSQL)

# Después de responder una encuesta
POST /api/responses
→ invalida clave "surveys:list" en Redis

# Siguiente petición
GET /api/surveys
→ X-Cache: MISS   (cache invalidado, recarga desde DB con nuevo conteo)
```

---

## Verificación Swagger UI

Se comprobó que todos los endpoints estaban correctamente documentados en `http://localhost:8000/docs`:

- Los endpoints protegidos muestran el candado 🔒
- Se puede probar el flujo completo desde la interfaz Swagger
- Los schemas de request/response están correctamente tipados con Pydantic

---

## Verificación del flujo admin

```bash
# 1. Crear primer admin via endpoint protegido
curl -X POST http://localhost:8000/admin/setup \
  -H "X-Setup-Key: <ADMIN_SETUP_KEY>" \
  -d '{"cc":"11111111","nombre":"Admin","apellido":"Bogotá","pin":"1234"}'

# 2. Login como admin
# CC: 11111111, PIN: 1234
# → redirige a /admin (no a /encuestas)

# 3. Verificar que ciudadano NO accede a /admin
# → redirige a /encuestas (RequireAdmin guard)
```

---

## Resultado de la Fase 2

- Los 4 bugs identificados fueron corregidos
- Flujo ciudadano completo verificado de extremo a extremo
- Panel admin funcional con navegación y logout
- Caché Redis confirmado con headers `X-Cache`
- JWT 401 consistente en todas las rutas protegidas
