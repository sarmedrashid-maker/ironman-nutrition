from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import ProgressEntry
from schemas import ProgressEntryCreate, ProgressEntryResponse

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/", response_model=List[ProgressEntryResponse])
def list_progress(user_id: int = 1, limit: int = 52, db: Session = Depends(get_db)):
    """Return up to 52 weeks of progress entries, newest first."""
    entries = (
        db.query(ProgressEntry)
        .filter(ProgressEntry.user_id == user_id)
        .order_by(ProgressEntry.entry_date.desc())
        .limit(limit)
        .all()
    )
    return entries


@router.post("/", response_model=ProgressEntryResponse)
def add_progress(payload: ProgressEntryCreate, db: Session = Depends(get_db)):
    # If an entry for this date already exists, update it instead of duplicating
    existing = db.query(ProgressEntry).filter(
        ProgressEntry.user_id == payload.user_id,
        ProgressEntry.entry_date == payload.entry_date,
    ).first()

    if existing:
        if payload.weight_lbs is not None:
            existing.weight_lbs = payload.weight_lbs
        if payload.navel_circumference_inches is not None:
            existing.navel_circumference_inches = payload.navel_circumference_inches
        if payload.notes:
            existing.notes = payload.notes
        db.commit()
        db.refresh(existing)
        return existing

    entry = ProgressEntry(
        user_id=payload.user_id,
        entry_date=payload.entry_date,
        weight_lbs=payload.weight_lbs,
        navel_circumference_inches=payload.navel_circumference_inches,
        notes=payload.notes,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
def delete_progress(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(ProgressEntry).filter(ProgressEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}
