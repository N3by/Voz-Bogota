from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class OptionIn(BaseModel):
    texto: str
    valor: int = 0


class OptionOut(BaseModel):
    id: int
    texto: str
    valor: int

    class Config:
        from_attributes = True


class QuestionIn(BaseModel):
    texto: str
    tipo: str = "opcion_multiple"
    orden: int = 0
    options: List[OptionIn] = []


class QuestionOut(BaseModel):
    id: int
    texto: str
    tipo: str
    orden: int
    options: List[OptionOut] = []

    class Config:
        from_attributes = True


class SurveyIn(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    duracion_min: int = 5
    questions: List[QuestionIn] = []


class SurveyUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    duracion_min: Optional[int] = None


class SurveyStatusUpdate(BaseModel):
    estado: str


class SurveyListItem(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str]
    categoria: Optional[str]
    estado: str
    duracion_min: int
    participant_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class SurveyDetail(BaseModel):
    id: int
    titulo: str
    descripcion: Optional[str]
    categoria: Optional[str]
    estado: str
    duracion_min: int
    created_at: datetime
    questions: List[QuestionOut] = []

    class Config:
        from_attributes = True
