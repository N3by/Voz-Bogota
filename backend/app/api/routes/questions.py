from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Question, User
from app.schemas.survey import QuestionIn, QuestionOut
from app.api.deps import require_admin
from app.core.redis_client import delete_pattern

router = APIRouter(prefix="/questions", tags=["Preguntas"])


@router.put("/{question_id}", response_model=QuestionOut)
def update_question(
    question_id: int,
    data: QuestionIn,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")

    question.texto = data.texto
    question.tipo = data.tipo
    question.orden = data.orden
    db.commit()
    db.refresh(question)
    delete_pattern("surveys:*")
    return QuestionOut.model_validate(question)


@router.delete("/{question_id}", status_code=204)
def delete_question(
    question_id: int,
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    db.delete(question)
    db.commit()
    delete_pattern("surveys:*")
