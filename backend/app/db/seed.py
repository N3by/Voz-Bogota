from sqlalchemy.orm import Session
from app.db.models import Localidad

LOCALIDADES_BOGOTA = [
    {"id": 1,  "nombre": "Usaquén",         "codigo": 1,  "lat_centro": 4.7016,  "lng_centro": -74.0307},
    {"id": 2,  "nombre": "Chapinero",        "codigo": 2,  "lat_centro": 4.6486,  "lng_centro": -74.0638},
    {"id": 3,  "nombre": "Santa Fe",         "codigo": 3,  "lat_centro": 4.5981,  "lng_centro": -74.0759},
    {"id": 4,  "nombre": "San Cristóbal",    "codigo": 4,  "lat_centro": 4.5656,  "lng_centro": -74.0827},
    {"id": 5,  "nombre": "Usme",             "codigo": 5,  "lat_centro": 4.4787,  "lng_centro": -74.1271},
    {"id": 6,  "nombre": "Tunjuelito",       "codigo": 6,  "lat_centro": 4.5756,  "lng_centro": -74.1346},
    {"id": 7,  "nombre": "Bosa",             "codigo": 7,  "lat_centro": 4.6097,  "lng_centro": -74.1985},
    {"id": 8,  "nombre": "Kennedy",          "codigo": 8,  "lat_centro": 4.6282,  "lng_centro": -74.1561},
    {"id": 9,  "nombre": "Fontibón",         "codigo": 9,  "lat_centro": 4.6785,  "lng_centro": -74.1461},
    {"id": 10, "nombre": "Engativá",         "codigo": 10, "lat_centro": 4.7082,  "lng_centro": -74.1156},
    {"id": 11, "nombre": "Suba",             "codigo": 11, "lat_centro": 4.7420,  "lng_centro": -74.0836},
    {"id": 12, "nombre": "Barrios Unidos",   "codigo": 12, "lat_centro": 4.6646,  "lng_centro": -74.0773},
    {"id": 13, "nombre": "Teusaquillo",      "codigo": 13, "lat_centro": 4.6441,  "lng_centro": -74.0935},
    {"id": 14, "nombre": "Los Mártires",     "codigo": 14, "lat_centro": 4.6082,  "lng_centro": -74.0906},
    {"id": 15, "nombre": "Antonio Nariño",   "codigo": 15, "lat_centro": 4.5827,  "lng_centro": -74.0966},
    {"id": 16, "nombre": "Puente Aranda",    "codigo": 16, "lat_centro": 4.6210,  "lng_centro": -74.1099},
    {"id": 17, "nombre": "La Candelaria",    "codigo": 17, "lat_centro": 4.5960,  "lng_centro": -74.0753},
    {"id": 18, "nombre": "Rafael Uribe",     "codigo": 18, "lat_centro": 4.5579,  "lng_centro": -74.1079},
    {"id": 19, "nombre": "Ciudad Bolívar",   "codigo": 19, "lat_centro": 4.5094,  "lng_centro": -74.1530},
    {"id": 20, "nombre": "Sumapaz",          "codigo": 20, "lat_centro": 4.2028,  "lng_centro": -74.1942},
]


def seed_localidades(db: Session):
    count = db.query(Localidad).count()
    if count == 0:
        for loc in LOCALIDADES_BOGOTA:
            db.add(Localidad(**loc))
        db.commit()
