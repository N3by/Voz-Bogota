from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class AnswerIn(BaseModel):
    question_id: int
    option_id: Optional[int] = None
    texto_libre: Optional[str] = None


class ResponseIn(BaseModel):
    survey_id: int
    answers: List[AnswerIn]


class ResponseOut(BaseModel):
    id: int
    survey_id: int
    localidad_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True
