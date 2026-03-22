from fastapi import Depends
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

_ANONYMOUS_EMAIL = "anonymous@safetyguard.local"


def _guest_password_hash() -> str:
    return pwd_context.hash("not-used")


def _get_or_create_anonymous_user(db: Session) -> User:
    user = db.query(User).filter(User.email == _ANONYMOUS_EMAIL).first()
    if user:
        return user
    user = User(
        email=_ANONYMOUS_EMAIL,
        hashed_password=_guest_password_hash(),
        full_name="Guest",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_current_user(db: Session = Depends(get_db)) -> User:
    """Single shared user; login/JWT removed."""
    return _get_or_create_anonymous_user(db)
