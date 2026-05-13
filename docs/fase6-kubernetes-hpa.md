# Fase 6 — Kubernetes Completo con HPA

**Proyecto:** Voz Bogotá — Sistema de Participación Ciudadana  
**Objetivo:** Demostrar todos los objetos Kubernetes funcionando juntos y verificar el HPA (HorizontalPodAutoscaler) escalando automáticamente bajo carga real.  
**Herramientas:** minikube v1.38.1 · kubectl v1.36.1 · Kubernetes v1.35.1

---

## Contexto

La Fase 6 completa el cuadro de objetos Kubernetes del proyecto. Sobre la base de la Fase 5 (que dejó Redis sin almacenamiento persistente), se añade un PVC para Redis y se demuestra el escalado automático horizontal con carga real generada desde pods dentro del mismo clúster.

---

## Paso 1 — Agregar PVC a Redis

En la Fase 5, Redis corría sin persistencia (`--appendonly no`). En la Fase 6 se habilita AOF (Append-Only File) y se monta un volumen persistente.

### `k8s/redis/pvc.yaml` (nuevo)

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: redis-pvc
  namespace: voz-bogota
spec:
  storageClassName: standard
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 500Mi
```

### `k8s/redis/deployment.yaml` (actualizado)

Cambios respecto a la Fase 5:
- `command`: de `--appendonly no` a `--appendonly yes`
- `volumeMounts`: nueva entrada en `/data` (directorio de datos de Redis)
- `volumes`: nuevo volumen referenciando `redis-pvc`

```yaml
command:
  - redis-server
  - --appendonly
  - "yes"
# ...
volumeMounts:
- name: redis-storage
  mountPath: /data
volumes:
- name: redis-storage
  persistentVolumeClaim:
    claimName: redis-pvc
```

### Aplicar al clúster

```bash
kubectl apply -f k8s/redis/pvc.yaml
kubectl apply -f k8s/redis/deployment.yaml
kubectl rollout status deployment/redis -n voz-bogota --timeout=60s
```

### Verificación

```bash
kubectl get pvc -n voz-bogota
# NAME           STATUS   VOLUME     CAPACITY   ACCESS MODES
# postgres-pvc   Bound    pvc-...    1Gi        RWO
# redis-pvc      Bound    pvc-...    500Mi      RWO

kubectl exec -n voz-bogota deployment/redis -- redis-cli CONFIG GET appendonly
# 1) "appendonly"
# 2) "yes"
```

---

## Paso 2 — Inventario completo de objetos Kubernetes

Con todos los recursos desplegados, `kubectl get all` muestra el cuadro completo:

```bash
kubectl get all -n voz-bogota
```

```
NAME                            READY   STATUS    RESTARTS
pod/backend-xxx-yyy             1/1     Running   0
pod/backend-xxx-zzz             1/1     Running   0
pod/frontend-xxx-aaa            1/1     Running   0
pod/frontend-xxx-bbb            1/1     Running   0
pod/postgres-xxx-ccc            1/1     Running   0
pod/redis-xxx-ddd               1/1     Running   0

NAME               TYPE        CLUSTER-IP       PORT(S)
service/backend    ClusterIP   10.102.101.12    8000/TCP
service/frontend   ClusterIP   10.102.145.167   80/TCP
service/postgres   ClusterIP   10.108.35.122    5432/TCP
service/redis      ClusterIP   10.106.196.254   6379/TCP

NAME                       READY   UP-TO-DATE   AVAILABLE
deployment.apps/backend    2/2     2            2
deployment.apps/frontend   2/2     2            2
deployment.apps/postgres   1/1     1            1
deployment.apps/redis      1/1     1            1

NAME                                  DESIRED   CURRENT   READY
replicaset.apps/backend-xxx           2         2         2
replicaset.apps/frontend-xxx          2         2         2
replicaset.apps/postgres-xxx          1         1         1
replicaset.apps/redis-xxx             1         1         1

NAME                                           TARGETS     MINPODS   MAXPODS   REPLICAS
horizontalpodautoscaler.autoscaling/backend    cpu: 2%/70%   2       5         2
horizontalpodautoscaler.autoscaling/frontend   cpu: 2%/70%   2       5         2
```

### PVCs

```bash
kubectl get pvc -n voz-bogota
# NAME           STATUS   CAPACITY
# postgres-pvc   Bound    1Gi
# redis-pvc      Bound    500Mi
```

### Ingress

```bash
kubectl get ingress -n voz-bogota
# NAME          CLASS   HOSTS   ADDRESS        PORTS
# voz-ingress   nginx   *       192.168.49.2   80
```

---

## Paso 3 — Cuadro de objetos K8s implementados

| Objeto K8s | Instancias | Descripción |
|---|---|---|
| **Namespace** | `voz-bogota` | Aísla todos los recursos del proyecto |
| **Pod** | 6 (en reposo) | Unidad de ejecución: 2 backend + 2 frontend + 1 postgres + 1 redis |
| **Deployment** | 4 | Declara el estado deseado de cada servicio |
| **ReplicaSet** | 4+ | Garantiza el número de réplicas (gestionado por Deployment) |
| **Service (ClusterIP)** | 4 | DNS interno: `backend:8000`, `frontend:80`, `postgres:5432`, `redis:6379` |
| **Ingress** | 1 | Punto de entrada único: `http://localhost` (con `minikube tunnel`) |
| **ConfigMap** | 1 | Variables no sensibles del backend (ALGORITHM, APP_ENV, etc.) |
| **Secret** | 1 | Credenciales y claves en base64 (generado desde `.env`) |
| **PersistentVolumeClaim** | 2 | Disco de 1 Gi para PostgreSQL, 500 Mi para Redis |
| **PersistentVolume** | 2 | Aprovisionado dinámicamente por minikube (StorageClass: standard) |
| **HPA** | 2 | Escala backend y frontend automáticamente según CPU |

---

## Paso 4 — Demostración del HPA en acción

### Script de demo

**Archivo:** `scripts/k8s-loadtest.sh`

El script lanza 3 pods `alpine` dentro del clúster que generan peticiones en bucle al backend. Para garantizar que el HPA se dispare en la demo, se baja temporalmente el umbral de CPU del 70% al 20% (y se restaura al finalizar).

```bash
./scripts/k8s-loadtest.sh
```

### Resultado observado

| Tiempo | CPU promedio | Réplicas backend | Evento |
|--------|-------------|-----------------|--------|
| t=0s | 2% / 70% | **2** | Estado inicial |
| t=15s | 49% / 20% | **4** | HPA dispara — escala a 4 |
| t=30s | 49% / 20% | **4→5** | HPA alcanza máximo — 5 pods |
| t=45s | 44% / 20% | **5** | Carga distribuida entre 5 pods |
| t=90s | — | **5** | Fin de carga, inicio de cool-down |
| ~t=6min | 2% / 70% | **2** | HPA escala hacia abajo (cool-down 5 min) |

### ¿Cómo decide el HPA cuántas réplicas crear?

```
réplicas_deseadas = ceil(réplicas_actuales × (CPU_actual / CPU_objetivo))

Ejemplo: ceil(2 × (49% / 20%)) = ceil(4.9) = 5
```

Con 2 réplicas iniciales y 49% de CPU promedio (objetivo 20%):
→ El HPA calcula que necesita **5 réplicas** para bajar cada pod a ≈20% de CPU.

---

## Paso 5 — Acceso a la aplicación

```bash
# En una terminal separada (mantenerla abierta)
minikube tunnel

# Abrir en el navegador
http://localhost
```

El `minikube tunnel` crea una ruta de red que expone el Ingress controller en `127.0.0.1:80`.

---

## Paso 6 — Comandos útiles de observación

```bash
# Ver todos los recursos del namespace
kubectl get all -n voz-bogota

# Observar pods en tiempo real
kubectl get pods -n voz-bogota -w

# Ver métricas de CPU/memoria actuales
kubectl top pods -n voz-bogota

# Ver logs de un pod específico
kubectl logs -f deployment/backend -n voz-bogota

# Describir el HPA (historial de eventos de scaling)
kubectl describe hpa backend-hpa -n voz-bogota

# Ver los PVCs
kubectl get pvc -n voz-bogota

# Ver el Ingress
kubectl get ingress -n voz-bogota
```

---

## Resultado de la Fase 6

| Verificación | Resultado |
|---|---|
| `kubectl get all -n voz-bogota` | 6 pods Running, 4 Services, 4 Deployments, 2 HPAs |
| `kubectl get pvc -n voz-bogota` | 2 PVCs Bound (postgres 1Gi + redis 500Mi) |
| `kubectl get hpa -n voz-bogota` | 2 HPAs activos con métricas reales |
| `kubectl top pods` | Métricas CPU/mem visibles (metrics-server activo) |
| `minikube tunnel` + `http://localhost` | App accesible en el navegador |
| HPA scaling demo | 2 → 5 pods en 45 segundos bajo carga |
| Cool-down | 5 → 2 pods al eliminar carga (~5 min) |

Todos los objetos fundamentales de Kubernetes están presentes y funcionando en el namespace `voz-bogota`.
