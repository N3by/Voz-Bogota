# Documentación — Voz Bogotá

Sistema de participación ciudadana para Bogotá. Documentación técnica de cada fase de desarrollo.

---

## Fases del proyecto

| Fase | Documento | Descripción |
|------|-----------|-------------|
| 1 | [Fase 1 — Fundación Local](fase1-fundacion-local.md) | MVP completo: FastAPI + React + PostgreSQL + Redis corriendo en local |
| 2 | [Fase 2 — Verificación de Integración](fase2-verificacion-integracion.md) | Pruebas end-to-end y corrección de 4 bugs de integración |
| 3 | [Fase 3 — Dockerización](fase3-dockerizacion.md) | Contenerización del frontend y backend con Docker |
| 4 | [Fase 4 — Docker Compose](fase4-docker-compose.md) | Orquestación de los 4 servicios con un solo comando |
| 5 | [Fase 5 — Kubernetes (minikube)](fase5-kubernetes.md) | Migración a Kubernetes con Deployments, HPA, Ingress y PVC |
| 6 | [Fase 6 — Kubernetes Completo con HPA](fase6-kubernetes-hpa.md) | Redis PVC, inventario completo de objetos K8s y demo de HPA bajo carga real |

---

## Stack tecnológico

```
React 18 + Vite  ──→  FastAPI (Python 3.13)  ──→  PostgreSQL 15
                                               ──→  Redis 7
```

**Infraestructura progresiva:**
```
Fase 1: local    →  Fase 3: Docker  →  Fase 4: Compose  →  Fase 5: Kubernetes
```
