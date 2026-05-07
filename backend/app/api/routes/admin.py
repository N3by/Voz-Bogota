from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.db.models import User, Survey, Response, ResponseAnswer, Localidad, Rol, EstadoEncuesta
from app.core.security import hash_pin
from app.api.deps import require_admin
from app.core.config import settings
from typing import Optional

router = APIRouter(prefix="/admin", tags=["Administración"])


@router.post("/setup", status_code=201)
def setup_admin(
    cc: str,
    nombre: str,
    apellido: str,
    pin: str,
    x_admin_setup_key: Optional[str] = Header(None),
    db: Session = Depends(get_db),
):
    if x_admin_setup_key != settings.ADMIN_SETUP_KEY:
        raise HTTPException(status_code=403, detail="Clave de setup incorrecta")

    existing = db.query(User).filter(User.cc == cc).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con esa cédula")

    admin = User(
        cc=cc,
        nombre=nombre,
        apellido=apellido,
        pin_hash=hash_pin(pin),
        rol=Rol.admin,
    )
    db.add(admin)
    db.commit()
    return {"mensaje": f"Admin '{nombre} {apellido}' creado exitosamente"}


@router.get("/stats")
def get_stats(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    total_usuarios = db.query(func.count(User.id)).scalar()
    total_encuestas = db.query(func.count(Survey.id)).scalar()
    encuestas_activas = db.query(func.count(Survey.id)).filter(Survey.estado == EstadoEncuesta.activa).scalar()
    total_participaciones = db.query(func.count(Response.id)).scalar()

    por_localidad = (
        db.query(Localidad.nombre, func.count(Response.id).label("total"))
        .join(Response, Response.localidad_id == Localidad.id, isouter=True)
        .group_by(Localidad.nombre)
        .all()
    )

    return {
        "total_usuarios": total_usuarios,
        "total_encuestas": total_encuestas,
        "encuestas_activas": encuestas_activas,
        "total_participaciones": total_participaciones,
        "participaciones_por_localidad": [
            {"localidad": nombre, "total": total} for nombre, total in por_localidad
        ],
    }


@router.get("/heatmap")
def get_heatmap(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    data = (
        db.query(
            Localidad.nombre,
            Localidad.lat_centro,
            Localidad.lng_centro,
            func.count(Response.id).label("intensidad"),
        )
        .outerjoin(Response, Response.localidad_id == Localidad.id)
        .group_by(Localidad.id, Localidad.nombre, Localidad.lat_centro, Localidad.lng_centro)
        .all()
    )

    return [
        {
            "localidad": nombre,
            "lat": lat,
            "lng": lng,
            "intensidad": intensidad,
        }
        for nombre, lat, lng, intensidad in data
    ]


@router.get("/surveys/{survey_id}/analytics")
def get_survey_analytics(
    survey_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")

    total_responses = db.query(func.count(Response.id)).filter(Response.survey_id == survey_id).scalar()

    por_localidad = (
        db.query(Localidad.nombre, func.count(Response.id).label("total"))
        .join(Response, Response.localidad_id == Localidad.id)
        .filter(Response.survey_id == survey_id)
        .group_by(Localidad.nombre)
        .all()
    )

    preguntas_analytics = []
    for question in survey.questions:
        if question.tipo == "opcion_multiple" or question.tipo == "escala":
            opciones = (
                db.query(ResponseAnswer.option_id, func.count(ResponseAnswer.id).label("votos"))
                .filter(ResponseAnswer.question_id == question.id)
                .group_by(ResponseAnswer.option_id)
                .all()
            )
            option_map = {o.id: o.texto for o in question.options}
            preguntas_analytics.append({
                "pregunta": question.texto,
                "tipo": question.tipo,
                "resultados": [
                    {"opcion": option_map.get(opt_id, "?"), "votos": votos}
                    for opt_id, votos in opciones
                ],
            })

    return {
        "survey_id": survey_id,
        "titulo": survey.titulo,
        "total_responses": total_responses,
        "por_localidad": [{"localidad": n, "total": t} for n, t in por_localidad],
        "preguntas": preguntas_analytics,
    }
