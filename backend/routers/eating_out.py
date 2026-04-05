from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, DailyLog, FoodEntry
from schemas import EatingOutRequest, EatingOutResponse
from services import claude_service
from routers.food_log import get_or_create_daily_log

router = APIRouter(prefix="/eating-out", tags=["eating-out"])


def _calculate_consumed(food_entries) -> dict:
    return {
        "calories": sum(e.calories for e in food_entries),
        "protein_g": sum(e.protein_g for e in food_entries),
        "carbs_g": sum(e.carbs_g for e in food_entries),
        "fat_g": sum(e.fat_g for e in food_entries),
    }


@router.post("/estimate", response_model=EatingOutResponse)
async def estimate_eating_out(
    payload: EatingOutRequest,
    db: Session = Depends(get_db),
):
    """
    Describe a restaurant meal and get macro estimates + portion guidance
    to hit remaining daily targets.
    """
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log_date = payload.log_date or date.today()
    log = get_or_create_daily_log(db, payload.user_id, log_date)

    consumed = _calculate_consumed(log.food_entries)

    remaining = {
        "calories": max(0, log.target_calories - consumed["calories"]),
        "protein_g": max(0, log.target_protein_g - consumed["protein_g"]),
        "carbs_g": max(0, log.target_carbs_g - consumed["carbs_g"]),
        "fat_g": max(0, log.target_fat_g - consumed["fat_g"]),
    }

    try:
        result = await claude_service.estimate_eating_out(
            description=payload.description,
            remaining_targets=remaining,
            dietary_restrictions=user.get_restrictions(),
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")

    return EatingOutResponse(**result)
