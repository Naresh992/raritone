from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import schemas
from app.database import get_db
from app.models import ContactMessage

router = APIRouter(prefix="/api/contact", tags=["contact"])


@router.post("")
def send_message(body: schemas.ContactIn, db: Session = Depends(get_db)):
    msg = ContactMessage(name=body.name, email=str(body.email).lower(),
                         subject=body.subject or "", message=body.message)
    db.add(msg)
    db.commit()
    return {"sent": True, "id": msg.id}
