from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import User
from schemas import UserCreate, UserUpdate, UserResponse, NutritionSettings

router = APIRouter(prefix="/users", tags=["users"])


def _enrich(user: User) -> User:
    """Convert stored JSON back to Python types for response serialization."""
    user.dietary_restrictions = user.get_restrictions()
    user.nutrition_settings = user.get_nutrition_settings()
    return user


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _enrich(user)


@router.post("/", response_model=UserResponse)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user = User(
        name=payload.name,
        sex=payload.sex,
        age=payload.age,
        weight_lbs=payload.weight_lbs,
        goal_weight_lbs=payload.goal_weight_lbs,
        height_inches=payload.height_inches,
    )
    user.set_restrictions(payload.dietary_restrictions)
    if payload.nutrition_settings:
        user.set_nutrition_settings(payload.nutrition_settings.model_dump())
    db.add(user)
    db.commit()
    db.refresh(user)
    return _enrich(user)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        if field == "dietary_restrictions":
            user.set_restrictions(value)
        elif field == "nutrition_settings":
            user.set_nutrition_settings(value.model_dump() if isinstance(value, NutritionSettings) else value)
        else:
            setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return _enrich(user)
