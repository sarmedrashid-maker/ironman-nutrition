"""
Seed the database with the initial user profile and meal library.
Safe to run multiple times — skips if data already exists.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from dotenv import load_dotenv
load_dotenv()

from database import engine, SessionLocal, Base
from models import User, Meal, ProgressEntry
from datetime import date, timedelta
import json

Base.metadata.create_all(bind=engine)


def seed():
    db = SessionLocal()
    try:
        # ── User ─────────────────────────────────────────────────────────────
        existing_user = db.query(User).filter(User.id == 1).first()
        if not existing_user:
            user = User(
                name="Athlete",
                sex="male",
                age=40,          # mid-range of 35–45
                weight_lbs=175.0,
                goal_weight_lbs=160.0,
                height_inches=70.0,  # 5'10"
            )
            user.set_restrictions(["no_mammal_meat"])
            db.add(user)
            db.flush()
            print(f"Created user: {user.name} (id={user.id})")
        else:
            user = existing_user
            print(f"User already exists (id={user.id}), skipping.")

        # ── Meal Library ──────────────────────────────────────────────────────
        existing_meals = db.query(Meal).filter(Meal.user_id == user.id).count()
        if existing_meals == 0:
            meals_data = [
                # ─ Breakfasts (slots 1–3) ─────────────────────────────────
                {
                    "meal_type": "breakfast", "slot_number": 1,
                    "name": "Power Oatmeal",
                    "calories": 603, "protein_g": 37, "carbs_g": 96, "fat_g": 10,
                    "ingredients": [
                        "80g rolled oats",
                        "120g banana",
                        "30g whey protein powder",
                        "240ml unsweetened almond milk",
                        "80g blueberries",
                    ],
                    "notes": "Microwave oats 3 min, stir in protein powder off heat, top with fruit.",
                },
                {
                    "meal_type": "breakfast", "slot_number": 2,
                    "name": "Salmon & Egg Bowl",
                    "calories": 625, "protein_g": 47, "carbs_g": 39, "fat_g": 32,
                    "ingredients": [
                        "100g smoked salmon",
                        "2 large eggs (scrambled)",
                        "50g baby spinach",
                        "75g avocado",
                        "2 slices whole grain bread (toasted)",
                    ],
                    "notes": "High protein, high fat — good for very easy or rest days.",
                },
                {
                    "meal_type": "breakfast", "slot_number": 3,
                    "name": "Greek Yogurt Parfait",
                    "calories": 472, "protein_g": 30, "carbs_g": 64, "fat_g": 12,
                    "ingredients": [
                        "200g non-fat Greek yogurt",
                        "40g low-sugar granola",
                        "100g mixed berries",
                        "15g honey",
                        "10g chia seeds",
                    ],
                    "notes": "Quick no-cook option. Prep overnight for a grab-and-go.",
                },
                # ─ Lunches (slots 1–2) ────────────────────────────────────
                {
                    "meal_type": "lunch", "slot_number": 1,
                    "name": "Tuna Rice Bowl",
                    "calories": 502, "protein_g": 52, "carbs_g": 58, "fat_g": 7,
                    "ingredients": [
                        "150g canned tuna (in water, drained)",
                        "200g cooked brown rice",
                        "80g shelled edamame",
                        "80g cucumber (sliced)",
                        "15ml low-sodium soy sauce",
                        "5ml sesame oil",
                    ],
                    "notes": "Excellent carb:protein ratio for post-morning-workout lunch.",
                },
                {
                    "meal_type": "lunch", "slot_number": 2,
                    "name": "Chicken Veggie Wrap",
                    "calories": 523, "protein_g": 56, "carbs_g": 45, "fat_g": 13,
                    "ingredients": [
                        "150g grilled chicken breast",
                        "1 large whole wheat tortilla",
                        "30g hummus",
                        "50g romaine lettuce",
                        "80g cherry tomatoes",
                        "50g roasted red peppers",
                    ],
                    "notes": "Can be prepped the night before. Keep hummus separate to prevent sogginess.",
                },
                # ─ Snacks (slots 1–6) ─────────────────────────────────────
                {
                    "meal_type": "snack", "slot_number": 1,
                    "name": "Banana & Almond Butter",
                    "calories": 367, "protein_g": 10, "carbs_g": 48, "fat_g": 18,
                    "ingredients": [
                        "120g banana",
                        "32g almond butter (2 tbsp)",
                        "2 plain rice cakes",
                    ],
                    "notes": "Good pre-workout snack 60–90 min before training.",
                },
                {
                    "meal_type": "snack", "slot_number": 2,
                    "name": "Recovery Protein Shake",
                    "calories": 272, "protein_g": 28, "carbs_g": 33, "fat_g": 6,
                    "ingredients": [
                        "30g whey protein powder",
                        "300ml unsweetened almond milk",
                        "120g banana",
                        "30g baby spinach",
                    ],
                    "notes": "Ideal within 30 min post-workout. Blend and drink immediately.",
                },
                {
                    "meal_type": "snack", "slot_number": 3,
                    "name": "Hummus & Veggies",
                    "calories": 274, "protein_g": 10, "carbs_g": 41, "fat_g": 10,
                    "ingredients": [
                        "80g hummus",
                        "100g baby carrots",
                        "100g cucumber (sliced)",
                        "100g bell pepper strips",
                    ],
                    "notes": "Volume eating — low calorie density, high fiber. Great for rest days.",
                },
                {
                    "meal_type": "snack", "slot_number": 4,
                    "name": "Endurance Trail Mix",
                    "calories": 489, "protein_g": 11, "carbs_g": 49, "fat_g": 31,
                    "ingredients": [
                        "30g raw almonds",
                        "20g cashews",
                        "30g dried cranberries (no sugar added)",
                        "20g dark chocolate chips (70%+)",
                    ],
                    "notes": "High calorie density — ideal for long training days or on-bike fueling.",
                },
                {
                    "meal_type": "snack", "slot_number": 5,
                    "name": "Tuna Avocado Crackers",
                    "calories": 320, "protein_g": 29, "carbs_g": 26, "fat_g": 12,
                    "ingredients": [
                        "100g canned tuna (in water, drained)",
                        "50g mashed avocado",
                        "30g whole grain crackers",
                        "Lemon juice and black pepper to taste",
                    ],
                    "notes": "Mix tuna with avocado as a spread. High protein, portable.",
                },
                {
                    "meal_type": "snack", "slot_number": 6,
                    "name": "Apple & Walnuts",
                    "calories": 285, "protein_g": 5, "carbs_g": 36, "fat_g": 16,
                    "ingredients": [
                        "180g apple",
                        "30g walnuts",
                        "1 tsp cinnamon (optional)",
                    ],
                    "notes": "Simple, whole-food snack. Walnuts provide omega-3s.",
                },
            ]

            for data in meals_data:
                meal = Meal(
                    user_id=user.id,
                    meal_type=data["meal_type"],
                    slot_number=data["slot_number"],
                    name=data["name"],
                    calories=data["calories"],
                    protein_g=data["protein_g"],
                    carbs_g=data["carbs_g"],
                    fat_g=data["fat_g"],
                    notes=data.get("notes", ""),
                )
                meal.set_ingredients(data["ingredients"])
                db.add(meal)
                print(f"  Added meal: {data['name']}")

        else:
            print(f"Meals already exist ({existing_meals}), skipping.")

        # ── Sample Progress Entries (last 6 weeks) ────────────────────────
        existing_progress = db.query(ProgressEntry).filter(ProgressEntry.user_id == user.id).count()
        if existing_progress == 0:
            today = date.today()
            # Simulate a gentle downward trend in weight and circumference
            sample_weights = [176.2, 175.8, 175.1, 174.8, 175.2, 174.5]
            sample_circumferences = [36.5, 36.3, 36.2, 36.0, 36.1, 35.8]

            for i, (w, c) in enumerate(zip(sample_weights, sample_circumferences)):
                entry_date = today - timedelta(weeks=5 - i)
                pe = ProgressEntry(
                    user_id=user.id,
                    entry_date=entry_date,
                    weight_lbs=w,
                    navel_circumference_inches=c,
                    notes="",
                )
                db.add(pe)
            print("Created 6 weeks of sample progress entries.")
        else:
            print(f"Progress entries already exist ({existing_progress}), skipping.")

        db.commit()
        print("\nSeed complete.")

    except Exception as e:
        db.rollback()
        print(f"Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
