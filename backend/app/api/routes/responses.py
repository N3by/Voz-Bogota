from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Response, ResponseAnswer, Survey, User
from app.schemas.response import ResponseIn, ResponseOut
from app.api.deps import get_current_user
from app.core.redis_client import delete_pattern

router = APIRouter(prefix="/responses", tags=["Respuestas"])


@router.post("", response_model=ResponseOut, status_code=201)
def submit_response(
    data: ResponseIn,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    survey = db.query(Survey).filter(Survey.id == data.survey_id).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")

    existing = db.query(Response).filter(
        Response.user_id == current_user.id,
        Response.survey_id == data.survey_id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ya respondiste esta encuesta")

    response = Response(
        user_id=current_user.id,
        survey_id=data.survey_id,
        localidad_id=current_user.localidad_id,
    )
    db.add(response)
    db.flush()

    for answer in data.answers:
        db.add(ResponseAnswer(
            response_id=response.id,
            question_id=answer.question_id,
            option_id=answer.option_id,
            texto_libre=answer.texto_libre,
        ))

    db.commit()
    db.refresh(response)
    delete_pattern("surveys:*")
    return ResponseOut.model_validate(response)
