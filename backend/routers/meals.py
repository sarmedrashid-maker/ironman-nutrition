from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Meal
from schemas import MealCreate, MealUpdate, MealResponse

router = APIRouter(prefix="/meals", tags=["meals"])


def _enrich(meal: Meal) -> Meal:
    """Convert stored JSON string back to list for response."""
    meal.ingredients = meal.get_ingredients()
    return meal


@router.get("/", response_model=List[MealResponse])
def list_meals(user_id: int = 1, db: Session = Depends(get_db)):
    meals = db.query(Meal).filter(Meal.user_id == user_id).order_by(
        Meal.meal_type, Meal.slot_number
    ).all()
    return [_enrich(m) for m in meals]


@router.get("/{meal_id}", response_model=MealResponse)
def get_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    return _enrich(meal)


@router.post("/", response_model=MealResponse)
def create_meal(payload: MealCreate, db: Session = Depends(get_db)):
    meal = Meal(
        user_id=payload.user_id,
        name=payload.name,
        meal_type=payload.meal_type,
        slot_number=payload.slot_number,
        calories=payload.calories,
        protein_g=payload.protein_g,
        carbs_g=payload.carbs_g,
        fat_g=payload.fat_g,
        notes=payload.notes,
    )
    meal.set_ingredients(payload.ingredients)
    db.add(meal)
    db.commit()
    db.refresh(meal)
    return _enrich(meal)


@router.put("/{meal_id}", response_model=MealResponse)
def update_meal(meal_id: int, payload: MealUpdate, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "ingredients":
            meal.set_ingredients(value)
        else:
            setattr(meal, field, value)

    db.commit()
    db.refresh(meal)
    return _enrich(meal)


@router.delete("/{meal_id}")
def delete_meal(meal_id: int, db: Session = Depends(get_db)):
    meal = db.query(Meal).filter(Meal.id == meal_id).first()
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    db.delete(meal)
    db.commit()
    return {"ok": True}
