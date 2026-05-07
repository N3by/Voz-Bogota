from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime


class RegisterStep1(BaseModel):
    nombre: str
    apellido: str
    cc: str

    @field_validator("cc")
    @classmethod
    def cc_must_be_numeric(cls, v):
        if not v.strip().isdigit():
            raise ValueError("La cédula debe contener solo números")
        return v.strip()


class RegisterStep2(BaseModel):
    telefono: Optional[str] = None
    localidad_id: Optional[int] = None


class RegisterRequest(BaseModel):
    nombre: str
    apellido: str
    cc: str
    telefono: Optional[str] = None
    localidad_id: Optional[int] = None
    pin: str

    @field_validator("pin")
    @classmethod
    def pin_must_be_4_digits(cls, v):
        if not v.isdigit() or len(v) != 4:
            raise ValueError("El PIN debe ser exactamente 4 dígitos")
        return v


class LoginRequest(BaseModel):
    cc: str
    pin: str


class UserOut(BaseModel):
    id: int
    cc: str
    nombre: str
    apellido: str
    telefono: Optional[str]
    localidad_id: Optional[int]
    rol: str
    created_at: datetime

    class Config:
        from_attributes = True


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
