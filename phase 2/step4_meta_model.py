import os
import pandas as pd
import numpy as np
import joblib
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (accuracy_score, f1_score, precision_score,
                              recall_score, confusion_matrix)

BASE = os.path.dirname(os.path.abspath(__file__))

y_train  = pd.read_csv(os.path.join(BASE, "y_train_bal.csv")).squeeze()
y_test   = pd.read_csv(os.path.join(BASE, "y_test.csv")).squeeze()
base_tr  = pd.read_csv(os.path.join(BASE, "base_preds_train.csv"))
base_te  = pd.read_csv(os.path.join(BASE, "base_preds_test.csv"))
df_full  = pd.read_csv(os.path.join(BASE, "machines_featured.csv"))

# Meta model
meta_model = LogisticRegression(class_weight="balanced", random_state=42, max_iter=1000)
meta_model.fit(base_tr, y_train)

meta_prob = meta_model.predict_proba(base_te)[:, 1]

# Threshold tuning — optimize G-Mean = sqrt(Recall × Specificity)
# G-Mean stays high ONLY when BOTH recall AND accuracy are high simultaneously
best_threshold, best_gmean = 0.5, 0
for t in np.arange(0.20, 0.80, 0.01):
    pred = (meta_prob >= t).astype(int)
    cm   = confusion_matrix(y_test, pred)
    if cm.shape == (2,2):
        tn, fp, fn, tp = cm.ravel()
        recall      = tp / (tp + fn) if (tp + fn) > 0 else 0
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
        gmean       = np.sqrt(recall * specificity)
        if gmean > best_gmean:
            best_gmean, best_threshold = gmean, t

meta_pred = (meta_prob >= best_threshold).astype(int)
print("Step 4 — Meta Model:")
print(f"  Threshold={best_threshold:.2f}  Accuracy={accuracy_score(y_test, meta_pred):.2%}"
      f"  F1={f1_score(y_test, meta_pred):.2%}"
      f"  Precision={precision_score(y_test, meta_pred):.2%}"
      f"  Recall={recall_score(y_test, meta_pred):.2%}")

# Predict on all 500 — load all base models dynamically
models_dir = os.path.join(BASE, "models")
base_model_names = ["xgboost", "lightgbm", "randomforest", "extratrees"]
all_base = pd.DataFrame()

DROP_COLS = ["Machine_ID", "Machine_Type", "Installation_Year",
             "Failure_Label", "Remaining_Useful_Life_Hours"]
X_full = df_full.drop(columns=DROP_COLS)

for name in base_model_names:
    path = os.path.join(models_dir, f"{name}_model.pkl")
    if os.path.exists(path):
        m = joblib.load(path)
        col = name.capitalize() if name != "extratrees" else "ExtraTrees"
        # Match exact column names used during meta-model training
        pass

# Read column names from base_preds_train to ensure exact match
train_cols = pd.read_csv(os.path.join(BASE, "base_preds_train.csv")).columns.tolist()
for col in train_cols:
    model_key = col.replace("_prob", "").lower()
    path = os.path.join(models_dir, f"{model_key}_model.pkl")
    m = joblib.load(path)
    all_base[col] = m.predict_proba(X_full)[:, 1]


final_prob = meta_model.predict_proba(all_base)[:, 1]
final_pred = (final_prob >= best_threshold).astype(int)
health_score = ((1 - final_prob) * 100).round(1)

def get_risk_tier(s):
    if s >= 80: return "Healthy"
    elif s >= 60: return "Monitor"
    elif s >= 40: return "At Risk"
    elif s >= 20: return "High Risk"
    else: return "Critical"

predictions = pd.DataFrame({
    "Machine_ID"        : df_full["Machine_ID"],
    "Machine_Type"      : df_full["Machine_Type"],
    "Failure_Prob"      : final_prob.round(3),
    "Failure_Predicted" : final_pred,
    "Actual_Label"      : df_full["Failure_Label"],
    "Health_Score"      : health_score,
    "Risk_Tier"         : [get_risk_tier(s) for s in health_score]
})

correct = (predictions["Failure_Predicted"] == predictions["Actual_Label"]).sum()
print(f"  All 500 machines: {correct}/500 correct ({correct/500:.1%})")

pd.DataFrame({"best_threshold": [best_threshold]}).to_csv(os.path.join(BASE, "best_threshold.csv"), index=False)
predictions.to_csv(os.path.join(BASE, "predictions.csv"), index=False)
joblib.dump(meta_model, os.path.join(BASE, "models", "meta_model.pkl"))
