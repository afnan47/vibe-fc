import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.svm import OneClassSVM
import joblib

def train_pipeline(csv_path, models_dir):
    print(f"Loading dataset from {csv_path}...")
    # Read the CSV with latin-1 encoding to avoid decoding errors
    df = pd.read_csv(csv_path, encoding='latin-1')
    
    # Selected features
    features = ['Dance', 'Energy', 'Valence', 'BPM', 'Acoustic', 'Loud (Db)']
    
    # Filter features and drop missing values
    df_clean = df[features].dropna()
    print(f"Loaded {len(df_clean)} valid samples for training.")
    
    # 1. Log transformation for Acoustic (right-skewed)
    df_clean['Acoustic_Log'] = np.log1p(df_clean['Acoustic'])
    
    # Define features for training (replace Acoustic with Acoustic_Log)
    train_features = ['Dance', 'Energy', 'Valence', 'BPM', 'Acoustic_Log', 'Loud (Db)']
    X_raw = df_clean[train_features].values
    
    # 2. Standardization
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_raw)
    
    # 3. Train One-Class SVM
    print("Training One-Class SVM...")
    nu_val = 0.05
    model = OneClassSVM(nu=nu_val, kernel='rbf', gamma='scale')
    model.fit(X_scaled)
    
    # 4. Calibration of Vibe Score (0% to 100%)
    # Retrieve raw decision scores (signed distances to separating hyperplane)
    d_scores = model.decision_function(X_scaled)
    
    # Calibrate Sigmoid parameters k and x0
    d_5 = np.percentile(d_scores, 5)   # 5th percentile gets 50% vibe score
    d_50 = np.percentile(d_scores, 50) # median gets 95% vibe score
    
    if d_50 > d_5:
        # P(d) = 100 / (1 + exp(-k * (d - x0)))
        # For d = d_5 to be 50%: 1 / (1 + exp(-k * (d_5 - x0))) = 0.50 => x0 = d_5
        # For d = d_50 to be 95%: 1 / (1 + exp(-k * (d_50 - d_5))) = 0.95 => exp(-k * (d_50 - d_5)) = 5/95 = 1/19
        # => -k * (d_50 - d_5) = -ln(19) => k = ln(19) / (d_50 - d_5)
        x0 = d_5
        k = np.log(19) / (d_50 - d_5)
    else:
        # Fallback to Min-Max if percentiles collapse
        x0 = np.min(d_scores)
        k = 1.0 / (np.max(d_scores) - x0 + 1e-6)
    
    # Save parameters
    calibration_params = {
        'x0': float(x0),
        'k': float(k),
        'd_min': float(np.min(d_scores)),
        'd_max': float(np.max(d_scores)),
        'd_50': float(d_50),
        'd_5': float(d_5),
    }
    
    # Ensure models directory exists
    os.makedirs(models_dir, exist_ok=True)
    
    # Save assets
    joblib.dump(scaler, os.path.join(models_dir, 'scaler.joblib'))
    joblib.dump(model, os.path.join(models_dir, 'vibe_model.joblib'))
    joblib.dump(calibration_params, os.path.join(models_dir, 'calibration.joblib'))
    
    print("\nTraining Complete.")
    print("---------------------------------")
    print(f"Calibration Parameters: {calibration_params}")
    print(f"Raw Decision Distances: min={d_scores.min():.4f}, median={d_50:.4f}, max={d_scores.max():.4f}")
    print(f"Fitted models and scaler saved to {models_dir}")
    print("---------------------------------\n")
    
    return scaler, model, calibration_params

def predict_track_vibe(raw_features, scaler, model, calibration_params):
    # Expected keys: ['Dance', 'Energy', 'Valence', 'BPM', 'Acoustic', 'Loud (Db)']
    dance = raw_features['Dance']
    energy = raw_features['Energy']
    valence = raw_features['Valence']
    bpm = raw_features['BPM']
    acoustic = raw_features['Acoustic']
    loudness = raw_features['Loud (Db)']
    
    # Preprocess
    acoustic_log = np.log1p(acoustic)
    
    # Standardize
    features_raw = np.array([[dance, energy, valence, bpm, acoustic_log, loudness]])
    features_scaled = scaler.transform(features_raw)
    
    # Distance score
    d = model.decision_function(features_scaled)[0]
    
    # Apply Sigmoid Calibration
    k = calibration_params['k']
    x0 = calibration_params['x0']
    
    # Calculate percentage
    vibe_percentage = 100.0 / (1.0 + np.exp(-k * (d - x0)))
    
    # Clip to [0.0%, 100.0%]
    vibe_percentage = np.clip(vibe_percentage, 0.0, 100.0)
    
    return vibe_percentage, d

if __name__ == '__main__':
    csv_path = 'The Ultimate FUT Playlist.csv'
    models_dir = 'backend/models'
    
    # Train
    scaler, model, calibration = train_pipeline(csv_path, models_dir)
    
    # Run test cases from requirements
    print("Running Verification Verification...")
    
    # Track A (High Vibe Match): Dance=75, Energy=85, Valence=65, BPM=125, Acoustic=2, Loud (Db)=-5
    track_a = {'Dance': 75, 'Energy': 85, 'Valence': 65, 'BPM': 125, 'Acoustic': 2, 'Loud (Db)': -5}
    score_a, dist_a = predict_track_vibe(track_a, scaler, model, calibration)
    print(f"Track A (High Vibe Match): Score={score_a:.1f}%, Distance={dist_a:.4f} (Expected: ~90% - 100%)")
    
    # Track B (Low Vibe Match): Dance=40, Energy=30, Valence=20, BPM=80, Acoustic=85, Loud (Db)=-14
    track_b = {'Dance': 40, 'Energy': 30, 'Valence': 20, 'BPM': 80, 'Acoustic': 85, 'Loud (Db)': -14}
    score_b, dist_b = predict_track_vibe(track_b, scaler, model, calibration)
    print(f"Track B (Low Vibe Match): Score={score_b:.1f}%, Distance={dist_b:.4f} (Expected: Outlier decay towards 0%)")
    
    # Track C (Standard Match from dataset): Let's test Yuksek Remix features from the CSV:
    # Dance=81, Energy=59, Valence=76, BPM=125, Acoustic=1, Loud (Db)=-6
    track_c = {'Dance': 81, 'Energy': 59, 'Valence': 76, 'BPM': 125, 'Acoustic': 1, 'Loud (Db)': -6}
    score_c, dist_c = predict_track_vibe(track_c, scaler, model, calibration)
    print(f"Track C (FUT Playlist Match): Score={score_c:.1f}%, Distance={dist_c:.4f}")
