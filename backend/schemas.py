from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import date, datetime


# ── Nutrition Settings ─────────────────────────────────────────────────────────

class ActivityMultipliers(BaseModel):
    rest:      float = 1.2
    easy:      float = 1.4
    moderate:  float = 1.6
    hard:      float = 1.8
    very_hard: float = 2.0
    extreme:   float = 2.2


class NutritionSettings(BaseModel):
    protein_g_per_kg:    float = 1.6
    fat_g_per_kg_min:    float = 1.0
    activity_multipliers: ActivityMultipliers = ActivityMultipliers()
    calorie_adj_rest:    float = -300
    calorie_adj_hard:    float = 150


# ── User ──────────────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    name: str
    sex: str = "male"
    age: int
    weight_lbs: float
    goal_weight_lbs: float
    height_inches: float = 70.0
    dietary_restrictions: List[str] = []
    nutrition_settings: Optional[NutritionSettings] = None


class UserCreate(UserBase):
    pass


class UserUpdate(BaseModel):
    name: Optional[str] = None
    sex: Optional[str] = None
    age: Optional[int] = None
    weight_lbs: Optional[float] = None
    goal_weight_lbs: Optional[float] = None
    height_inches: Optional[float] = None
    dietary_restrictions: Optional[List[str]] = None
    nutrition_settings: Optional[NutritionSettings] = None


class UserResponse(BaseModel):
    id: int
    name: str
    sex: str
    age: int
    weight_lbs: float
    goal_weight_lbs: float
    height_inches: float
    dietary_restrictions: List[str]
    nutrition_settings: NutritionSettings
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Meal ──────────────────────────────────────────────────────────────────────

class MealBase(BaseModel):
    name: str
    meal_type: str
    slot_number: int
    calories: float = 0
    protein_g: float = 0
    carbs_g: float = 0
    fat_g: float = 0
    ingredients: List[str] = []
    notes: str = ""


class MealCreate(MealBase):
    user_id: int


class MealUpdate(BaseModel):
    name: Optional[str] = None
    meal_type: Optional[str] = None
    slot_number: Optional[int] = None
    calories: Optional[float] = None
    protein_g: Optional[float] = None
    carbs_g: Optional[float] = None
    fat_g: Optional[float] = None
    ingredients: Optional[List[str]] = None
    notes: Optional[str] = None


class MealResponse(MealBase):
    id: int
    user_id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Food Entry ─────────────────────────────────────────────────────────────────

class FoodEntryCreate(BaseModel):
    daily_log_id: int
    meal_category: str = "breakfast"
    description: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    servings: float = 1.0
    has_mammal: bool = False
    source: str = "manual"
    raw_input: str = ""


class FoodEntryUpdate(BaseModel):
    servings: float


class FoodEntryResponse(BaseModel):
    id: int
    daily_log_id: int
    meal_category: str
    description: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    servings: float
    has_mammal: bool
    source: str
    raw_input: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Daily Log ──────────────────────────────────────────────────────────────────

class DailyLogResponse(BaseModel):
    id: int
    user_id: int
    log_date: date
    tss: int
    special_instructions: str
    training_notes: str
    target_calories: float
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    bmr: float
    tdee: float
    food_entries: List[FoodEntryResponse] = []
    model_config = ConfigDict(from_attributes=True)


class TSSUpdate(BaseModel):
    tss: int


class InstructionsUpdate(BaseModel):
    instructions: str


class TrainingNotesUpdate(BaseModel):
    notes: str


# ── NLP Food Parse ─────────────────────────────────────────────────────────────

class FoodParseRequest(BaseModel):
    text: str
    user_id: int = 1


class ParsedFoodItem(BaseModel):
    name: str
    amount: str
    calories: float
    protein_g: float
    carbs_g: float
    fat_g: float
    has_mammal: bool = False


class FoodParseResponse(BaseModel):
    items: List[ParsedFoodItem]
    total_calories: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    has_mammal_flag: bool = False


# ── Training ───────────────────────────────────────────────────────────────────

class TrainingUploadResponse(BaseModel):
    tss: Optional[float]
    activity_name: Optional[str]
    duration_seconds: Optional[float]
    distance_meters: Optional[float]
    message: str
    raw_fields: Optional[dict] = None


# ── Eating Out ─────────────────────────────────────────────────────────────────

class EatingOutRequest(BaseModel):
    description: str
    user_id: int = 1
    log_date: Optional[date] = None


class EatingOutResponse(BaseModel):
    meal_items: List[dict]
    estimated_macros: dict
    recommendation: str
    portion_guidance: str
    flags: List[str] = []


# ── Progress ───────────────────────────────────────────────────────────────────

class ProgressEntryCreate(BaseModel):
    user_id: int = 1
    entry_date: date
    weight_lbs: Optional[float] = None
    navel_circumference_inches: Optional[float] = None
    notes: str = ""


class ProgressEntryResponse(BaseModel):
    id: int
    user_id: int
    entry_date: date
    weight_lbs: Optional[float]
    navel_circumference_inches: Optional[float]
    notes: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


# ── Macro Targets ──────────────────────────────────────────────────────────────

class MacroTargets(BaseModel):
    target_calories: float
    target_protein_g: float
    target_carbs_g: float
    target_fat_g: float
    bmr: float
    tdee: float
    tss: int
