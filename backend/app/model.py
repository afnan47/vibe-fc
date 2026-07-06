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
    """Lazy loads model assets from disk. If missing, initiates self-healing auto-training."""
    global _scaler, _model, _calibration
    if _scaler is not None and _model is not None and _calibration is not None:
        return _scaler, _model, _calibration

    if not os.path.exists(SCALER_PATH) or not os.path.exists(MODEL_PATH) or not os.path.exists(CALIBRATION_PATH):
        print("[Model] Model assets missing. Initiating self-healing auto-training...")
        db_path = "The Ultimate FUT Playlist.db"
        # Check if DB is in workspace root or backend parent
        if not os.path.exists(db_path):
            db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "The Ultimate FUT Playlist.db")
            if not os.path.exists(db_path):
                db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "The Ultimate FUT Playlist.db")
        
        # If DB is missing, check if CSV is present to auto-convert
        if not os.path.exists(db_path):
            print(f"[Model] SQLite DB missing at {db_path}. Checking for CSV to self-heal...")
            csv_path = "The Ultimate FUT Playlist.csv"
            if not os.path.exists(csv_path):
                csv_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "The Ultimate FUT Playlist.csv")
            if os.path.exists(csv_path):
                try:
                    try:
                        from backend.scripts.convert_csv_to_sqlite import convert
                    except ImportError:
                        from scripts.convert_csv_to_sqlite import convert
                    if convert:
                        convert()
                except Exception as e:
                    print(f"[Model] Auto DB conversion failed: {e}")

        # Train model assets
        try:
            try:
                from backend.scripts.train_vibe_model import train_pipeline
            except ImportError:
                from scripts.train_vibe_model import train_pipeline
            
            if train_pipeline:
                train_pipeline(db_path, MODELS_DIR)
                print("[Model] Self-healing training completed successfully.")
            else:
                raise FileNotFoundError("Could not import train_pipeline script.")
        except Exception as e:
            print(f"[Model] Auto-training failed: {e}")
            raise FileNotFoundError(
                f"Model assets not found and auto-training failed: {e}. "
                "Please run `backend/scripts/train_vibe_model.py` manually."
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
