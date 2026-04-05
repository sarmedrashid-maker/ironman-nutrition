"""
Ironman Nutrition Calculator

Evidence basis:
- Mifflin-St Jeor BMR equation (Mifflin et al., 1990) — widely validated
- IOC consensus on sports nutrition for endurance athletes (Thomas et al., 2016)
- ACSM/AND/DC joint position statement on nutrition and athletic performance (2016)
- Ironman carbohydrate periodization: Jeukendrup (2017), Burke et al. (2011)
- Protein recommendations: Stokes et al. (2018), Phillips & Van Loon (2011)

All formula parameters are now user-overridable via nutrition_settings.
Carbs always fill remaining calories after protein and fat are allocated,
so increasing protein automatically decreases carbs (compensation).
"""

DEFAULT_SETTINGS = {
    "protein_g_per_kg": 1.6,
    "fat_g_per_kg_min": 1.0,
    "activity_multipliers": {
        "rest":      1.2,
        "easy":      1.4,
        "moderate":  1.6,
        "hard":      1.8,
        "very_hard": 2.0,
        "extreme":   2.2,
    },
    "calorie_adj_rest": -300,
    "calorie_adj_hard": 150,
}


def calculate_bmr(weight_lbs: float, height_inches: float, age: int, sex: str) -> float:
    """Mifflin-St Jeor equation. Confidence: >90%."""
    weight_kg = weight_lbs * 0.453592
    height_cm = height_inches * 2.54
    if sex.lower() == "male":
        return 10 * weight_kg + 6.25 * height_cm - 5 * age + 5
    else:
        return 10 * weight_kg + 6.25 * height_cm - 5 * age - 161


def _get_tss_bracket(tss: int) -> str:
    if tss == 0:       return "rest"
    elif tss <= 49:    return "easy"
    elif tss <= 99:    return "moderate"
    elif tss <= 149:   return "hard"
    elif tss <= 199:   return "very_hard"
    else:              return "extreme"


def _merge_settings(user_settings: dict | None) -> dict:
    """Merge user overrides on top of defaults (deep merge for multipliers)."""
    s = dict(DEFAULT_SETTINGS)
    s["activity_multipliers"] = dict(DEFAULT_SETTINGS["activity_multipliers"])
    if user_settings:
        for k, v in user_settings.items():
            if k == "activity_multipliers" and isinstance(v, dict):
                s["activity_multipliers"].update(v)
            else:
                s[k] = v
    return s


def calculate_daily_targets(
    weight_lbs: float,
    goal_weight_lbs: float,
    height_inches: float,
    age: int,
    sex: str,
    tss: int = 0,
    nutrition_settings: dict | None = None,
) -> dict:
    """
    Calculate daily macro targets.

    Macro allocation order:
    1. TDEE = BMR × activity_multiplier (user-adjustable per TSS bracket)
    2. Calorie target = TDEE ± adjustment (deficit on rest, surplus on hard)
    3. Protein = protein_g_per_kg × weight_kg  (user-adjustable)
    4. Fat = fat_g_per_kg_min × weight_kg      (user-adjustable)
    5. Carbs = (target_cals − protein_kcal − fat_kcal) / 4  ← fills remainder

    This means changing protein automatically adjusts carbs to compensate.
    """
    s = _merge_settings(nutrition_settings)
    weight_kg = weight_lbs * 0.453592
    bracket = _get_tss_bracket(tss)

    bmr = calculate_bmr(weight_lbs, height_inches, age, sex)
    multiplier = s["activity_multipliers"][bracket]
    tdee = bmr * multiplier

    # Calorie target
    if tss < 50 and weight_lbs > goal_weight_lbs:
        target_cals = tdee + s["calorie_adj_rest"]
    elif tss >= 100:
        target_cals = tdee + s["calorie_adj_hard"]
    else:
        target_cals = tdee

    # Protein (user-defined g/kg)
    protein_g = s["protein_g_per_kg"] * weight_kg
    protein_kcal = protein_g * 4

    # Fat (minimum g/kg, fills remainder on low-carb days)
    fat_g = s["fat_g_per_kg_min"] * weight_kg
    fat_kcal = fat_g * 9

    # Carbs fill the remaining calories (compensation happens here)
    carbs_kcal = target_cals - protein_kcal - fat_kcal
    carbs_g = max(0, carbs_kcal / 4)

    # If carbs are zero (protein+fat exceed target), raise target_cals to cover minimum
    if carbs_g == 0:
        target_cals = protein_kcal + fat_kcal
        carbs_g = 0.0

    return {
        "target_calories": round(target_cals),
        "target_protein_g": round(protein_g, 1),
        "target_carbs_g": round(carbs_g, 1),
        "target_fat_g": round(fat_g, 1),
        "bmr": round(bmr),
        "tdee": round(tdee),
        "tss": tss,
    }
