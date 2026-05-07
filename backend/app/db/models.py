from sqlalchemy import Column, Integer, String, Enum, ForeignKey, DateTime, Text, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.db.database import Base


class Rol(str, enum.Enum):
    ciudadano = "ciudadano"
    admin = "admin"


class EstadoEncuesta(str, enum.Enum):
    activa = "activa"
    cerrada = "cerrada"


class TipoPregunta(str, enum.Enum):
    opcion_multiple = "opcion_multiple"
    escala = "escala"
    texto_libre = "texto_libre"


class Localidad(Base):
    __tablename__ = "localidades"

    id = Column(Integer, primary_key=True)
    nombre = Column(String(100), nullable=False)
    codigo = Column(Integer, nullable=False, unique=True)
    lat_centro = Column(Float, nullable=False)
    lng_centro = Column(Float, nullable=False)

    usuarios = relationship("User", back_populates="localidad")
    responses = relationship("Response", back_populates="localidad")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    cc = Column(String(20), unique=True, nullable=False, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100), nullable=False)
    telefono = Column(String(20), nullable=True)
    localidad_id = Column(Integer, ForeignKey("localidades.id"), nullable=True)
    pin_hash = Column(String(255), nullable=False)
    rol = Column(Enum(Rol), default=Rol.ciudadano, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    localidad = relationship("Localidad", back_populates="usuarios")
    responses = relationship("Response", back_populates="user")
    surveys_creadas = relationship("Survey", back_populates="creador")


class Survey(Base):
    __tablename__ = "surveys"

    id = Column(Integer, primary_key=True)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=True)
    categoria = Column(String(100), nullable=True)
    estado = Column(Enum(EstadoEncuesta), default=EstadoEncuesta.activa, nullable=False)
    duracion_min = Column(Integer, default=5)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    creador = relationship("User", back_populates="surveys_creadas")
    questions = relationship("Question", back_populates="survey", cascade="all, delete-orphan", order_by="Question.orden")
    responses = relationship("Response", back_populates="survey")


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True)
    survey_id = Column(Integer, ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    texto = Column(Text, nullable=False)
    tipo = Column(Enum(TipoPregunta), default=TipoPregunta.opcion_multiple, nullable=False)
    orden = Column(Integer, default=0)

    survey = relationship("Survey", back_populates="questions")
    options = relationship("Option", back_populates="question", cascade="all, delete-orphan")
    answers = relationship("ResponseAnswer", back_populates="question")


class Option(Base):
    __tablename__ = "options"

    id = Column(Integer, primary_key=True)
    question_id = Column(Integer, ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    texto = Column(String(300), nullable=False)
    valor = Column(Integer, default=0)

    question = relationship("Question", back_populates="options")
    answers = relationship("ResponseAnswer", back_populates="option")


class Response(Base):
    __tablename__ = "responses"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    survey_id = Column(Integer, ForeignKey("surveys.id"), nullable=False)
    localidad_id = Column(Integer, ForeignKey("localidades.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="responses")
    survey = relationship("Survey", back_populates="responses")
    localidad = relationship("Localidad", back_populates="responses")
    answers = relationship("ResponseAnswer", back_populates="response", cascade="all, delete-orphan")


class ResponseAnswer(Base):
    __tablename__ = "response_answers"

    id = Column(Integer, primary_key=True)
    response_id = Column(Integer, ForeignKey("responses.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    option_id = Column(Integer, ForeignKey("options.id"), nullable=True)
    texto_libre = Column(Text, nullable=True)

    response = relationship("Response", back_populates="answers")
    question = relationship("Question", back_populates="answers")
    option = relationship("Option", back_populates="answers")
