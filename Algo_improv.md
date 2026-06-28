
## Objective

Replace a failing Mahalanobis distance/Chi-squared algorithm with a **One-Class Support Vector Machine (OC-SVM)** with an **RBF Kernel** to judge if a song matches the "FIFA Vibe". The model must train exclusively on the positive examples provided in `The Ultimate FUT Playlist.csv`, handle feature skewness, and output a clean `0.0%` to `100.0%` probability score instead of a binary `-1` or `1`.

## Step-by-Step Technical Requirements

### 1. Data Loading & Feature Selection

* Load `The Ultimate FUT Playlist.csv`.
* Extract the following 6 core features for training: `['Dance', 'Energy', 'Valence', 'BPM', 'Acoustic', 'Loud (Db)']`.

### 2. Preprocessing & Skewness Treatment

* **Log Transformation:** The `Acoustic` feature is heavily right-skewed. Apply a log transformation to normalize its distribution: `df['Acoustic_Log'] = np.log1p(df['Acoustic'])`. Drop the raw `Acoustic` column.
* **Standardization:** Use `sklearn.preprocessing.StandardScaler` to fit and transform all 6 features into standardized Z-scores. Save this fitted scaler object so it can be reused during inference.

### 3. Model Training (One-Class SVM)

* Use `sklearn.svm.OneClassSVM` with an `rbf` kernel.
* Set initial hyper-parameters to: `nu=0.05` (assumes ~5% anomaly/outlier tolerance in the training playlist) and `gamma='scale'`.
* Train the model *only* on the processed 6-feature matrix from the CSV.

### 4. Vibe Score Calibration (The 0% to 100% Projection)

By default, `OneClassSVM.predict()` returns `1` or `-1`. We need a continuous percentage score.

* Use `model.decision_function(X)` to get the signed distance of the training samples to the separating hyperplane.
* Map these raw distance scores to a `0.0%` to `100.0%` scale using a Sigmoid function or Min-Max scaling of the training distances. Ensure that a track sitting perfectly inside the dense core of the playlist scores close to `95%-100%`, while extreme outliers decay gracefully toward `0%`.

### 5. Implementation Script Requirements

Write a clean, modular Python script (`train_vibe_model.py`) that executes the following functions:

1. `train_pipeline(csv_path)`: Loads data, preprocesses features, trains the OC-SVM, calibrates the scoring mechanism, and saves both the **fitted scaler** and the **trained model** to disk using `joblib` (`scaler.joblib`, `vibe_model.joblib`).
2. `predict_track_vibe(raw_features)`: An inference function designed for the live web app backend. It takes a single raw dictionary of a song's features (e.g., `{'Dance': 75, 'Energy': 80, ...}`), applies the log transformation to `Acoustic`, scales it using the loaded `scaler.joblib`, passes it to `vibe_model.joblib`, and returns a single formatted percentage float string (e.g., `"87.4%"`).

### 6. Verification & Output Printouts

At the end of training, the script should print to the console:

* A summary description of the training distances.
* Test cases showing the calculated Vibe Score for 3 mock tracks:
* **Track A (High Vibe Match):** `Dance=75, Energy=85, Valence=65, BPM=125, Acoustic=2, Loud (Db)=-5`
* **Track B (Low Vibe Match - Acoustic/Slow):** `Dance=40, Energy=30, Valence=20, BPM=80, Acoustic=85, Loud (Db)=-14`
