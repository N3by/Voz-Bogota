from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import User, Rol
from app.schemas.user import RegisterRequest, LoginRequest, TokenOut, UserOut
from app.core.security import hash_pin, verify_pin, create_access_token
from app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.cc == data.cc).first()
    if existing:
        raise HTTPException(status_code=400, detail="Ya existe un usuario con esa cédula")

    user = User(
        cc=data.cc,
        nombre=data.nombre,
        apellido=data.apellido,
        telefono=data.telefono,
        localidad_id=data.localidad_id,
        pin_hash=hash_pin(data.pin),
        rol=Rol.ciudadano,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": user.id, "rol": user.rol.value})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenOut)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.cc == data.cc).first()
    if not user or not verify_pin(data.pin, user.pin_hash):
        raise HTTPException(status_code=401, detail="Cédula o PIN incorrecto")

    token = create_access_token({"sub": user.id, "rol": user.rol.value})
    return TokenOut(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
