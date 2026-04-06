import json
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

DEFAULT_NUTRITION_SETTINGS = {
    "protein_g_per_kg": 1.6,
    "fat_g_per_kg_min": 1.0,
    "activity_multipliers": {
        "rest": 1.2,
        "easy": 1.4,
        "moderate": 1.6,
        "hard": 1.8,
        "very_hard": 2.0,
        "extreme": 2.2,
    },
    "calorie_adj_rest": -300,
    "calorie_adj_hard": 150,
}


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    sex = Column(String, default="male")
    age = Column(Integer)
    weight_lbs = Column(Float)
    goal_weight_lbs = Column(Float)
    height_inches = Column(Float, default=70.0)
    dietary_restrictions = Column(Text, default="[]")
    nutrition_settings = Column(Text, default="{}")  # JSON overrides for formula params
    created_at = Column(DateTime, default=datetime.utcnow)

    meals = relationship("Meal", back_populates="user", cascade="all, delete-orphan")
    daily_logs = relationship("DailyLog", back_populates="user", cascade="all, delete-orphan")
    progress_entries = relationship("ProgressEntry", back_populates="user", cascade="all, delete-orphan")

    def get_restrictions(self):
        return json.loads(self.dietary_restrictions or "[]")

    def set_restrictions(self, restrictions: list):
        self.dietary_restrictions = json.dumps(restrictions)

    def get_nutrition_settings(self) -> dict:
        stored = json.loads(self.nutrition_settings or "{}")
        # Deep merge with defaults so missing keys always have a value
        merged = {**DEFAULT_NUTRITION_SETTINGS}
        merged["activity_multipliers"] = {
            **DEFAULT_NUTRITION_SETTINGS["activity_multipliers"],
            **stored.get("activity_multipliers", {}),
        }
        for k, v in stored.items():
            if k != "activity_multipliers":
                merged[k] = v
        return merged

    def set_nutrition_settings(self, settings: dict):
        self.nutrition_settings = json.dumps(settings)


class Meal(Base):
    __tablename__ = "meals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    meal_type = Column(String, nullable=False)
    slot_number = Column(Integer, nullable=False)
    calories = Column(Float, default=0)
    protein_g = Column(Float, default=0)
    carbs_g = Column(Float, default=0)
    fat_g = Column(Float, default=0)
    ingredients = Column(Text, default="[]")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="meals")

    def get_ingredients(self):
        return json.loads(self.ingredients or "[]")

    def set_ingredients(self, items: list):
        self.ingredients = json.dumps(items)


class DailyLog(Base):
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    log_date = Column(Date, nullable=False)
    tss = Column(Integer, default=0)
    special_instructions = Column(Text, default="")
    training_notes = Column(Text, default="")  # free-text training context
    target_calories = Column(Float, default=0)
    target_protein_g = Column(Float, default=0)
    target_carbs_g = Column(Float, default=0)
    target_fat_g = Column(Float, default=0)
    bmr = Column(Float, default=0)
    tdee = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="daily_logs")
    food_entries = relationship("FoodEntry", back_populates="daily_log", cascade="all, delete-orphan")


class FoodEntry(Base):
    __tablename__ = "food_entries"

    id = Column(Integer, primary_key=True, index=True)
    daily_log_id = Column(Integer, ForeignKey("daily_logs.id"), nullable=False)
    meal_category = Column(String, default="breakfast")  # breakfast/lunch/dinner/snack_1/snack_2/snack_3
    description = Column(String, nullable=False)
    calories = Column(Float, default=0)
    protein_g = Column(Float, default=0)
    carbs_g = Column(Float, default=0)
    fat_g = Column(Float, default=0)
    servings = Column(Float, default=1.0)
    has_mammal = Column(Boolean, default=False)
    source = Column(String, default="manual")
    raw_input = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    daily_log = relationship("DailyLog", back_populates="food_entries")


class ProgressEntry(Base):
    __tablename__ = "progress_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    entry_date = Column(Date, nullable=False)
    weight_lbs = Column(Float)
    navel_circumference_inches = Column(Float)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="progress_entries")
