"""
Claude API service for NLP food parsing and eating-out estimation.

Uses anthropic SDK — AsyncAnthropic client for FastAPI async endpoints.
Model: claude-opus-4-6 (most capable, best for nutrition reasoning).
"""

import json
import os
from typing import Optional
import anthropic

_client: Optional[anthropic.AsyncAnthropic] = None


def get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError(
                "ANTHROPIC_API_KEY environment variable not set. "
                "Copy .env.example to .env and add your key."
            )
        _client = anthropic.AsyncAnthropic(api_key=api_key)
    return _client


MAMMAL_MEATS = [
    "beef", "pork", "lamb", "veal", "venison", "bison", "buffalo",
    "mutton", "rabbit", "goat", "horse", "elk", "boar", "bacon",
    "ham", "sausage", "pepperoni", "salami", "prosciutto", "chorizo",
    "steak", "burger", "ground beef", "ground pork",
]


async def parse_food_input(text: str, dietary_restrictions: list) -> dict:
    """
    Parse natural language food description into structured macro data.

    Prompt is designed to return valid JSON matching the ParsedFoodItem schema.
    has_mammal flags mammal MEAT only (not dairy/eggs) — consistent with the
    user's 'no mammals' restriction interpreted as no mammal meat.

    Confidence: >90% for common foods; less reliable for regional dishes
    or ambiguous inputs. The response is parsed as JSON; if Claude returns
    unexpected format, we raise a clear error rather than guessing.
    """
    client = get_client()

    mammal_list = ", ".join(MAMMAL_MEATS)
    restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "none"

    prompt = f"""You are a sports nutrition assistant helping an Ironman triathlete track macros.

Parse the following food description and return ONLY valid JSON — no prose, no markdown fences.

Food description: "{text}"
Dietary restrictions: {restrictions_str}

Return this exact JSON structure:
{{
  "items": [
    {{
      "name": "descriptive food name",
      "amount": "amount with unit (e.g. 150g, 1 cup)",
      "calories": <number>,
      "protein_g": <number>,
      "carbs_g": <number>,
      "fat_g": <number>,
      "has_mammal": <true if this item contains mammal MEAT such as {mammal_list} — false for dairy, eggs, fish, poultry>
    }}
  ],
  "total_calories": <sum>,
  "total_protein_g": <sum>,
  "total_carbs_g": <sum>,
  "total_fat_g": <sum>
}}

Use USDA nutritional data as your reference. Round to 1 decimal place.
If the amount is ambiguous, use a standard serving size and note it in the name field."""

    message = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned invalid JSON: {e}\nRaw response: {raw[:500]}")

    # Validate required keys
    if "items" not in parsed or "total_calories" not in parsed:
        raise ValueError(f"Unexpected response structure from Claude: {raw[:500]}")

    # Top-level mammal flag
    parsed["has_mammal_flag"] = any(item.get("has_mammal", False) for item in parsed["items"])

    return parsed


async def estimate_tss_from_notes(notes: str) -> dict:
    """
    Estimate TSS from a plain-language training session description.
    Returns {tss: int, reasoning: str}.
    """
    client = get_client()

    prompt = f"""You are a sports science assistant for an Ironman triathlete.

Based on the training session description below, estimate the Training Stress Score (TSS).

TSS scale reference:
- 0: Rest day (no training)
- 1–49: Easy (recovery ride/run/swim, <1hr low intensity)
- 50–99: Moderate (90min zone-2 work, steady aerobic session)
- 100–149: Hard (long intervals, hard brick, tempo run, 2–3hr ride)
- 150–199: Very Hard (race simulation, 4–5hr long ride, back-to-back hard sessions)
- 200+: Extreme (full race day, multiple long hard sessions)

Training description: "{notes}"

Return ONLY valid JSON — no prose, no markdown:
{{"tss": <integer>, "reasoning": "<1-2 sentence explanation>"}}"""

    message = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned invalid JSON: {e}\nRaw: {raw[:300]}")

    return {"tss": int(parsed["tss"]), "reasoning": parsed.get("reasoning", "")}


async def estimate_eating_out(
    description: str,
    remaining_targets: dict,
    dietary_restrictions: list,
) -> dict:
    """
    Estimate macros for a restaurant meal and advise portion sizes
    to hit remaining daily targets.

    Confidence: ~80% for common restaurant cuisines; less reliable for
    regional or unusual dishes. Claude acknowledges uncertainty in its response.
    """
    client = get_client()

    restrictions_str = ", ".join(dietary_restrictions) if dietary_restrictions else "none"
    remaining_str = (
        f"{remaining_targets.get('calories', 0):.0f} kcal, "
        f"{remaining_targets.get('protein_g', 0):.1f}g protein, "
        f"{remaining_targets.get('carbs_g', 0):.1f}g carbs, "
        f"{remaining_targets.get('fat_g', 0):.1f}g fat"
    )

    prompt = f"""You are a sports nutrition advisor for an Ironman triathlete.

Restaurant/meal description: "{description}"
Dietary restrictions: {restrictions_str}
Remaining daily macro targets: {remaining_str}

Estimate the nutritional content of a typical serving of the described meal and recommend
how much to eat to approximately match the remaining targets.

Return ONLY valid JSON — no prose, no markdown:
{{
  "meal_items": [
    {{
      "name": "item name",
      "typical_serving": "e.g. 1 entree (~400g)",
      "calories_per_serving": <number>,
      "protein_g_per_serving": <number>,
      "carbs_g_per_serving": <number>,
      "fat_g_per_serving": <number>
    }}
  ],
  "estimated_macros": {{
    "calories": <total for recommended portions>,
    "protein_g": <total>,
    "carbs_g": <total>,
    "fat_g": <total>
  }},
  "recommendation": "Plain-English advice on what and how much to order (1-2 sentences)",
  "portion_guidance": "Specific portion sizes (e.g. 'order the salmon entree, eat 3/4 of it, skip the bread basket')",
  "flags": ["list any dietary restriction conflicts or warnings — empty array if none"]
}}"""

    message = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(f"Claude returned invalid JSON: {e}\nRaw response: {raw[:500]}")

    return parsed
