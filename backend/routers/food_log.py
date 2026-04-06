from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User, DailyLog, FoodEntry, Meal
from schemas import (
    DailyLogResponse, FoodEntryCreate, FoodEntryUpdate, FoodEntryResponse,
    FoodParseRequest, FoodParseResponse, TSSUpdate,
    InstructionsUpdate, TrainingNotesUpdate,
    EatingOutRequest, EatingOutResponse,
)
from services import nutrition_calc, claude_service

router = APIRouter(prefix="/food-log", tags=["food-log"])

# Meal type → default meal_category mapping for library items
MEAL_TYPE_TO_CATEGORY = {
    "breakfast": "breakfast",
    "lunch":     "lunch",
    "dinner":    "dinner",
    "snack":     "snack_1",
}


def get_or_create_daily_log(db: Session, user_id: int, log_date: date) -> DailyLog:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log = db.query(DailyLog).filter(
        DailyLog.user_id == user_id,
        DailyLog.log_date == log_date,
    ).first()

    # Always recalculate targets from current profile settings so that
    # changes on the Profile page are immediately reflected in the dashboard.
    targets = nutrition_calc.calculate_daily_targets(
        weight_lbs=user.weight_lbs,
        goal_weight_lbs=user.goal_weight_lbs,
        height_inches=user.height_inches,
        age=user.age,
        sex=user.sex,
        tss=log.tss if log else 0,
        nutrition_settings=user.get_nutrition_settings(),
    )

    if log is None:
        log = DailyLog(
            user_id=user_id,
            log_date=log_date,
            tss=0,
            **{k: targets[k] for k in (
                "target_calories", "target_protein_g",
                "target_carbs_g", "target_fat_g", "bmr", "tdee"
            )},
        )
        db.add(log)
    else:
        log.target_calories = targets["target_calories"]
        log.target_protein_g = targets["target_protein_g"]
        log.target_carbs_g = targets["target_carbs_g"]
        log.target_fat_g = targets["target_fat_g"]
        log.bmr = targets["bmr"]
        log.tdee = targets["tdee"]

    db.commit()
    db.refresh(log)
    return log


@router.get("/{log_date}", response_model=DailyLogResponse)
def get_daily_log(log_date: date, user_id: int = 1, db: Session = Depends(get_db)):
    return get_or_create_daily_log(db, user_id, log_date)


@router.put("/{log_date}/tss")
def update_tss(log_date: date, payload: TSSUpdate, user_id: int = 1, db: Session = Depends(get_db)):
    log = get_or_create_daily_log(db, user_id, log_date)
    user = db.query(User).filter(User.id == user_id).first()

    targets = nutrition_calc.calculate_daily_targets(
        weight_lbs=user.weight_lbs,
        goal_weight_lbs=user.goal_weight_lbs,
        height_inches=user.height_inches,
        age=user.age,
        sex=user.sex,
        tss=payload.tss,
        nutrition_settings=user.get_nutrition_settings(),
    )

    log.tss = payload.tss
    log.target_calories = targets["target_calories"]
    log.target_protein_g = targets["target_protein_g"]
    log.target_carbs_g = targets["target_carbs_g"]
    log.target_fat_g = targets["target_fat_g"]
    log.bmr = targets["bmr"]
    log.tdee = targets["tdee"]

    db.commit()
    db.refresh(log)
    return {"ok": True, "targets": targets}


@router.put("/{log_date}/instructions")
def update_instructions(
    log_date: date, payload: InstructionsUpdate,
    user_id: int = 1, db: Session = Depends(get_db)
):
    log = get_or_create_daily_log(db, user_id, log_date)
    log.special_instructions = payload.instructions
    db.commit()
    return {"ok": True}


@router.put("/{log_date}/training-notes")
def update_training_notes(
    log_date: date, payload: TrainingNotesUpdate,
    user_id: int = 1, db: Session = Depends(get_db)
):
    log = get_or_create_daily_log(db, user_id, log_date)
    log.training_notes = payload.notes
    db.commit()
    return {"ok": True}


@router.post("/parse", response_model=FoodParseResponse)
async def parse_food(payload: FoodParseRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        result = await claude_service.parse_food_input(payload.text, user.get_restrictions())
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude API error: {str(e)}")

    return FoodParseResponse(**result)


@router.post("/entry", response_model=FoodEntryResponse)
def add_food_entry(payload: FoodEntryCreate, db: Session = Depends(get_db)):
    entry = FoodEntry(
        daily_log_id=payload.daily_log_id,
        meal_category=payload.meal_category,
        description=payload.description,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        servings=payload.servings,
        has_mammal=payload.has_mammal,
        source=payload.source,
        raw_input=payload.raw_input,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/entry/{entry_id}/servings", response_model=FoodEntryResponse)
def update_entry_servings(entry_id: int, payload: FoodEntryUpdate, db: Session = Depends(get_db)):
    entry = db.query(FoodEntry).filter(FoodEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    if payload.servings <= 0:
        raise HTTPException(status_code=422, detail="Servings must be greater than 0")
    # Recalculate macros: base = current / old_servings, new total = base * new_servings
    old = entry.servings or 1.0
    ratio = payload.servings / old
    entry.calories  *= ratio
    entry.protein_g *= ratio
    entry.carbs_g   *= ratio
    entry.fat_g     *= ratio
    entry.servings   = payload.servings
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/entry/{entry_id}")
def delete_food_entry(entry_id: int, db: Session = Depends(get_db)):
    entry = db.query(FoodEntry).filter(FoodEntry.id == entry_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    db.delete(entry)
    db.commit()
    return {"ok": True}


@router.post("/add-meal/{meal_id}")
def add_meal_to_log(
    meal_id: int,
    log_date: date,
    meal_category: str = "breakfast",
    user_id: int = 1,
    db: Session = Depends(get_db),
):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    log = get_or_create_daily_log(db, user_id, log_date)

    # Default category from meal type if caller didn't specify
    category = meal_category or MEAL_TYPE_TO_CATEGORY.get(meal.meal_type, "breakfast")

    entry = FoodEntry(
        daily_log_id=log.id,
        meal_category=category,
        description=meal.name,
        calories=meal.calories,
        protein_g=meal.protein_g,
        carbs_g=meal.carbs_g,
        fat_g=meal.fat_g,
        has_mammal=False,
        source="meal_library",
        raw_input=f"From library: {meal.name}",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.post("/restaurant-estimate", response_model=EatingOutResponse)
async def restaurant_estimate(
    payload: EatingOutRequest,
    db: Session = Depends(get_db),
):
    """Inline restaurant meal estimator (replaces separate Eating Out page)."""
    user = db.query(User).filter(User.id == payload.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log_date = payload.log_date or date.today()
    log = get_or_create_daily_log(db, payload.user_id, log_date)

    consumed_cals   = sum(e.calories   for e in log.food_entries)
    consumed_prot   = sum(e.protein_g  for e in log.food_entries)
    consumed_carbs  = sum(e.carbs_g    for e in log.food_entries)
    consumed_fat    = sum(e.fat_g      for e in log.food_entries)

    remaining = {
        "calories":  max(0, log.target_calories  - consumed_cals),
        "protein_g": max(0, log.target_protein_g - consumed_prot),
        "carbs_g":   max(0, log.target_carbs_g   - consumed_carbs),
        "fat_g":     max(0, log.target_fat_g     - consumed_fat),
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
