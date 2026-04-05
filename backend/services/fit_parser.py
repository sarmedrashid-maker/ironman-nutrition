"""
FIT file parser for TSS and training metadata.

Confidence note (~75%):
fitparse is a well-maintained library and the 'session' message type is
standard in Garmin FIT files. However, the exact field name for TSS
('training_stress_score') may not be present in all device/activity types —
some older Garmin devices or third-party apps may omit it or use a different
field. The parser returns all available session fields in raw_fields so you
can debug if TSS is not found.

TrainingPeaks JSON export format confidence (~60%):
The JSON export schema varies by account type and API version. We support
the most common formats but you may need to adjust field paths.
"""

import io
import json
from typing import Optional

try:
    import fitparse
    FITPARSE_AVAILABLE = True
except ImportError:
    FITPARSE_AVAILABLE = False


def parse_fit_file(file_bytes: bytes) -> dict:
    """
    Parse a .fit file and extract TSS and activity metadata.

    Returns dict with keys: tss, activity_name, duration_seconds,
    distance_meters, message, raw_fields (all session fields for debugging).
    """
    if not FITPARSE_AVAILABLE:
        return {
            "tss": None,
            "activity_name": None,
            "duration_seconds": None,
            "distance_meters": None,
            "message": "fitparse library not installed. Run: pip install fitparse",
            "raw_fields": None,
        }

    try:
        fitfile = fitparse.FitFile(io.BytesIO(file_bytes))
    except Exception as e:
        return {
            "tss": None,
            "activity_name": None,
            "duration_seconds": None,
            "distance_meters": None,
            "message": f"Failed to parse FIT file: {str(e)}",
            "raw_fields": None,
        }

    tss = None
    activity_name = None
    duration_seconds = None
    distance_meters = None
    raw_fields = {}

    # Collect all session-level fields
    for record in fitfile.get_messages("session"):
        for field in record:
            if field.value is not None:
                raw_fields[field.name] = field.value

        # TSS: primary field name in Garmin FIT spec is 'training_stress_score'
        # Confidence ~75% — some devices use different names
        for candidate in ["training_stress_score", "tss", "training_stress"]:
            if candidate in raw_fields:
                tss = raw_fields[candidate]
                break

        duration_seconds = raw_fields.get("total_timer_time") or raw_fields.get("total_elapsed_time")
        distance_meters = raw_fields.get("total_distance")

    # Activity name is in 'activity' message type
    for record in fitfile.get_messages("activity"):
        for field in record:
            if field.name in ("sport", "sub_sport", "name") and field.value:
                activity_name = str(field.value)
                break

    if tss is None:
        msg = (
            "TSS field not found in FIT file session data. "
            f"Available fields: {list(raw_fields.keys())}. "
            "Your device may not record TSS — enter it manually."
        )
    else:
        msg = f"Successfully parsed FIT file. TSS: {tss}"

    return {
        "tss": float(tss) if tss is not None else None,
        "activity_name": activity_name,
        "duration_seconds": float(duration_seconds) if duration_seconds else None,
        "distance_meters": float(distance_meters) if distance_meters else None,
        "message": msg,
        "raw_fields": raw_fields,
    }


def parse_json_training_file(file_bytes: bytes) -> dict:
    """
    Parse a JSON training file from Garmin Connect, TrainingPeaks, or similar.

    Confidence ~60%: JSON export schemas vary significantly across platforms
    and API versions. We check multiple common field paths.

    Supported formats:
    - TrainingPeaks workout export: {"tss": 123, "name": "...", ...}
    - Garmin Connect activity export: {"summaryDTO": {"trainingEffect": ..., ...}}
    - Simple format: {"tss": 123}
    - Array format (TrainingPeaks plans): [{"tss": 123, ...}]
    """
    try:
        data = json.loads(file_bytes.decode("utf-8"))
    except Exception as e:
        return {
            "tss": None,
            "activity_name": None,
            "duration_seconds": None,
            "distance_meters": None,
            "message": f"Invalid JSON: {str(e)}",
            "raw_fields": None,
        }

    # If it's a list, take the first element
    if isinstance(data, list):
        if not data:
            return {"tss": None, "activity_name": None, "duration_seconds": None,
                    "distance_meters": None, "message": "Empty array in JSON file", "raw_fields": None}
        data = data[0]

    tss = None
    activity_name = None
    duration_seconds = None
    distance_meters = None

    # Try common TSS field paths
    tss_paths = [
        lambda d: d.get("tss"),
        lambda d: d.get("metrics", {}).get("tss"),
        lambda d: d.get("workout", {}).get("tss"),
        lambda d: d.get("summary", {}).get("tss"),
        lambda d: d.get("training_stress_score"),
        lambda d: d.get("trainingStressScore"),
        # Garmin Connect summaryDTO does not have TSS directly — their
        # aerobicEffect is not TSS. We do not guess from aerobicEffect.
    ]

    for path_fn in tss_paths:
        try:
            val = path_fn(data)
            if val is not None:
                tss = float(val)
                break
        except Exception:
            continue

    # Activity name
    for key in ["name", "workout_name", "workoutName", "title", "activity_name", "activityName"]:
        if data.get(key):
            activity_name = str(data[key])
            break

    # Duration
    for key in ["duration", "total_timer_time", "totalTimerTime", "duration_seconds"]:
        if data.get(key):
            try:
                duration_seconds = float(data[key])
            except Exception:
                pass
            break

    # Distance
    for key in ["distance", "total_distance", "totalDistance", "distance_meters"]:
        if data.get(key):
            try:
                distance_meters = float(data[key])
            except Exception:
                pass
            break

    if tss is None:
        msg = (
            "TSS not found in JSON file. "
            "Checked fields: tss, metrics.tss, training_stress_score, trainingStressScore. "
            "Enter TSS manually if your export uses a different schema."
        )
    else:
        msg = f"Successfully parsed JSON file. TSS: {tss}"

    return {
        "tss": tss,
        "activity_name": activity_name,
        "duration_seconds": duration_seconds,
        "distance_meters": distance_meters,
        "message": msg,
        "raw_fields": data if isinstance(data, dict) else None,
    }
