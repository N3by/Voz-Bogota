from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.db.database import engine, SessionLocal
from app.db import models
from app.db.seed import seed_localidades
from app.api.routes import auth, surveys, responses, admin, questions

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Voz Bogotá API",
    description="Sistema de participación ciudadana para Bogotá",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(surveys.router)
app.include_router(responses.router)
app.include_router(admin.router)
app.include_router(questions.router)


@app.on_event("startup")
def on_startup():
    db = SessionLocal()
    try:
        seed_localidades(db)
    finally:
        db.close()


@app.get("/health", tags=["Sistema"])
def health():
    return {"status": "ok", "app": "Voz Bogotá"}
