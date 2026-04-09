from datetime import date
from fastapi import APIRouter, Depends, File, UploadFile, HTTPException, Form
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import User, DailyLog
from schemas import TrainingUploadResponse
from services import fit_parser, nutrition_calc, claude_service
from routers.food_log import get_or_create_daily_log

router = APIRouter(prefix="/training", tags=["training"])


class TSSEstimateRequest(BaseModel):
    notes: str


@router.post("/estimate-tss")
async def estimate_tss(payload: TSSEstimateRequest):
    """Use Claude to estimate TSS from a plain-language training description."""
    if not payload.notes.strip():
        raise HTTPException(status_code=422, detail="Notes cannot be empty")
    try:
        result = await claude_service.estimate_tss_from_notes(payload.notes)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")
    return result


@router.post("/upload", response_model=TrainingUploadResponse)
async def upload_training_file(
    file: UploadFile = File(...),
    log_date: date = Form(...),
    user_id: int = Form(1),
    db: Session = Depends(get_db),
):
    """
    Accept a .fit or .json training file and extract TSS.
    If TSS is found, automatically updates the daily log targets.

    FIT file parsing confidence: ~75% (see services/fit_parser.py for details).
    JSON file parsing confidence: ~60% (schema varies by platform).
    """
    contents = await file.read()
    filename = file.filename or ""

    if filename.lower().endswith(".fit"):
        result = fit_parser.parse_fit_file(contents)
    elif filename.lower().endswith(".json"):
        result = fit_parser.parse_json_training_file(contents)
    else:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type. Upload a .fit or .json file.",
        )

    # If TSS was found, update the daily log
    if result["tss"] is not None:
        log = get_or_create_daily_log(db, user_id, log_date)

        user = db.query(User).filter(User.id == user_id).first()

        tss_int = int(result["tss"])
        targets = nutrition_calc.calculate_daily_targets(
            weight_lbs=user.weight_lbs,
            goal_weight_lbs=user.goal_weight_lbs,
            height_inches=user.height_inches,
            age=user.age,
            sex=user.sex,
            tss=tss_int,
        )

        log.tss = tss_int
        log.target_calories = targets["target_calories"]
        log.target_protein_g = targets["target_protein_g"]
        log.target_carbs_g = targets["target_carbs_g"]
        log.target_fat_g = targets["target_fat_g"]
        log.bmr = targets["bmr"]
        log.tdee = targets["tdee"]
        db.commit()

    return TrainingUploadResponse(
        tss=result["tss"],
        activity_name=result["activity_name"],
        duration_seconds=result["duration_seconds"],
        distance_meters=result["distance_meters"],
        message=result["message"],
        raw_fields=result.get("raw_fields"),
    )
