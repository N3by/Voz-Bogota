import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.db.models import Survey, Question, Option, Response, Localidad, EstadoEncuesta, User
from app.schemas.survey import SurveyListItem, SurveyDetail, SurveyIn, SurveyUpdate, SurveyStatusUpdate, QuestionIn
from app.api.deps import get_current_user, require_admin
from app.core.redis_client import get_cache, set_cache, delete_pattern
from typing import List

router = APIRouter(prefix="/surveys", tags=["Encuestas"])

CACHE_KEY_LIST = "surveys:active:list"


@router.get("", response_model=List[SurveyListItem])
def list_surveys(include_closed: bool = False, db: Session = Depends(get_db)):
    cache_key = "surveys:all:list" if include_closed else CACHE_KEY_LIST
    cached = get_cache(cache_key)
    if cached:
        return json.loads(cached)

    query = db.query(Survey)
    if not include_closed:
        query = query.filter(Survey.estado == EstadoEncuesta.activa)
    surveys = query.all()

    result = []
    for s in surveys:
        count = db.query(func.count(Response.id)).filter(Response.survey_id == s.id).scalar()
        item = SurveyListItem(
            id=s.id,
            titulo=s.titulo,
            descripcion=s.descripcion,
            categoria=s.categoria,
            estado=s.estado.value,
            duracion_min=s.duracion_min,
            participant_count=count,
            created_at=s.created_at,
        )
        result.append(item)

    set_cache(cache_key, json.dumps([i.model_dump(mode="json") for i in result]), ttl=60)
    return result


@router.get("/heatmap/public")
def get_public_heatmap(db: Session = Depends(get_db)):
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
        {"localidad": nombre, "lat": lat, "lng": lng, "intensidad": intensidad}
        for nombre, lat, lng, intensidad in data
    ]


@router.get("/{survey_id}", response_model=SurveyDetail)
def get_survey(survey_id: int, db: Session = Depends(get_db)):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    return SurveyDetail.model_validate(survey)


@router.post("", response_model=SurveyDetail, status_code=201)
def create_survey(
    data: SurveyIn,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    survey = Survey(
        titulo=data.titulo,
        descripcion=data.descripcion,
        categoria=data.categoria,
        duracion_min=data.duracion_min,
        created_by=current_user.id,
    )
    db.add(survey)
    db.flush()

    for i, q_data in enumerate(data.questions):
        question = Question(
            survey_id=survey.id,
            texto=q_data.texto,
            tipo=q_data.tipo,
            orden=q_data.orden or i,
        )
        db.add(question)
        db.flush()
        for opt_data in q_data.options:
            db.add(Option(question_id=question.id, texto=opt_data.texto, valor=opt_data.valor))

    db.commit()
    db.refresh(survey)
    delete_pattern("surveys:*")
    return SurveyDetail.model_validate(survey)


@router.put("/{survey_id}", response_model=SurveyDetail)
def update_survey(
    survey_id: int,
    data: SurveyUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(survey, field, value)

    db.commit()
    db.refresh(survey)
    delete_pattern("surveys:*")
    return SurveyDetail.model_validate(survey)


@router.patch("/{survey_id}/status", response_model=SurveyDetail)
def update_survey_status(
    survey_id: int,
    data: SurveyStatusUpdate,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    if data.estado not in ("activa", "cerrada"):
        raise HTTPException(status_code=400, detail="Estado inválido")

    survey.estado = EstadoEncuesta(data.estado)
    db.commit()
    db.refresh(survey)
    delete_pattern("surveys:*")
    return SurveyDetail.model_validate(survey)


@router.post("/{survey_id}/questions", response_model=SurveyDetail, status_code=201)
def add_question(
    survey_id: int,
    data: QuestionIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    survey = db.query(Survey).filter(Survey.id == survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")

    question = Question(
        survey_id=survey_id,
        texto=data.texto,
        tipo=data.tipo,
        orden=data.orden,
    )
    db.add(question)
    db.flush()

    for opt_data in data.options:
        db.add(Option(question_id=question.id, texto=opt_data.texto, valor=opt_data.valor))

    db.commit()
    db.refresh(survey)
    delete_pattern("surveys:*")
    return SurveyDetail.model_validate(survey)
