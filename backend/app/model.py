import os
import numpy as np
import joblib

# Paths to models
MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models')
SCALER_PATH = os.path.join(MODELS_DIR, 'scaler.joblib')
MODEL_PATH = os.path.join(MODELS_DIR, 'vibe_model.joblib')
CALIBRATION_PATH = os.path.join(MODELS_DIR, 'calibration.joblib')

_scaler = None
_model = None
_calibration = None

def load_model_assets():
    """Lazy loads model assets from disk."""
    global _scaler, _model, _calibration
    if _scaler is not None and _model is not None and _calibration is not None:
        return _scaler, _model, _calibration

    if not os.path.exists(SCALER_PATH) or not os.path.exists(MODEL_PATH) or not os.path.exists(CALIBRATION_PATH):
        raise FileNotFoundError(
            "Model assets not found. Please run the model training script `backend/scripts/train_vibe_model.py` first."
        )

    _scaler = joblib.load(SCALER_PATH)
    _model = joblib.load(MODEL_PATH)
    _calibration = joblib.load(CALIBRATION_PATH)
    return _scaler, _model, _calibration

def score_track(features: dict) -> tuple[float, float]:
    """
    Computes the FIFA Vibe score for a dictionary of features.
    Features should be scaled to the training set range (0-100 for percentage features).
    Returns (vibe_score, decision_distance).
    """
    scaler, model, calibration = load_model_assets()

    # Raw features in training order: ['Dance', 'Energy', 'Valence', 'BPM', 'Acoustic_Log', 'Loud (Db)']
    dance = features['danceability']
    energy = features['energy']
    valence = features['valence']
    bpm = features['tempo']
    acoustic = features['acousticness']
    loudness = features['loudness']

    # Preprocessing: log transformation for acousticness
    acoustic_log = np.log1p(acoustic)

    # Convert to 2D array
    raw_arr = np.array([[dance, energy, valence, bpm, acoustic_log, loudness]])
    
    # Standardize
    scaled_arr = scaler.transform(raw_arr)

    # Compute decision function distance
    d = model.decision_function(scaled_arr)[0]

    # Apply Sigmoid Calibration
    k = calibration['k']
    x0 = calibration['x0']
    
    vibe_percentage = 100.0 / (1.0 + np.exp(-k * (d - x0)))
    vibe_percentage = np.clip(vibe_percentage, 0.0, 100.0)

    return float(vibe_percentage), float(d)
