"""
Crea el primer (o cualquier) usuario administrador de Voz Bogotá.

Uso interactivo (desde el directorio backend/):
    python scripts/create_admin.py

Uso con argumentos:
    python scripts/create_admin.py --cc 12345678 --nombre Juan --apellido Pérez --pin 1234
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.db.models import User, Rol
from app.core.security import hash_pin


def create_admin(cc: str, nombre: str, apellido: str, pin: str):
    if not pin.isdigit() or len(pin) != 4:
        print("ERROR: El PIN debe ser exactamente 4 dígitos numéricos.")
        sys.exit(1)

    if not cc.strip():
        print("ERROR: La cédula no puede estar vacía.")
        sys.exit(1)

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.cc == cc).first()
        if existing:
            print(f"ERROR: Ya existe un usuario con CC {cc} (rol: {existing.rol.value}).")
            sys.exit(1)

        admin = User(
            cc=cc,
            nombre=nombre,
            apellido=apellido,
            pin_hash=hash_pin(pin),
            rol=Rol.admin,
        )
        db.add(admin)
        db.commit()
        print(f"✓ Admin '{nombre} {apellido}' (CC: {cc}) creado exitosamente.")
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(description="Crear administrador de Voz Bogotá")
    parser.add_argument("--cc",       help="Número de cédula")
    parser.add_argument("--nombre",   help="Nombre")
    parser.add_argument("--apellido", help="Apellido")
    parser.add_argument("--pin",      help="PIN de 4 dígitos")
    args = parser.parse_args()

    cc       = args.cc       or input("Cédula:   ").strip()
    nombre   = args.nombre   or input("Nombre:   ").strip()
    apellido = args.apellido or input("Apellido: ").strip()
    pin      = args.pin      or input("PIN (4 dígitos): ").strip()

    create_admin(cc, nombre, apellido, pin)


if __name__ == "__main__":
    main()
