import os
import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import joblib
import optuna
optuna.logging.set_verbosity(optuna.logging.WARNING)

from sklearn.ensemble import RandomForestClassifier, ExtraTreesClassifier
from sklearn.model_selection import cross_val_score, StratifiedKFold
from sklearn.metrics import accuracy_score, f1_score
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from imblearn.over_sampling import SMOTE

BASE = os.path.dirname(os.path.abspath(__file__))

X_train = pd.read_csv(os.path.join(BASE, "X_train.csv"))
X_test  = pd.read_csv(os.path.join(BASE, "X_test.csv"))
y_train = pd.read_csv(os.path.join(BASE, "y_train.csv")).squeeze()
y_test  = pd.read_csv(os.path.join(BASE, "y_test.csv")).squeeze()

# SMOTE — balance classes
smote = SMOTE(random_state=42)
X_train_bal, y_train_bal = smote.fit_resample(X_train, y_train)

ratio = (y_train == 0).sum() / (y_train == 1).sum()
cv    = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

# ── Optuna: find best XGBoost hyperparameters ────────────────────
print("Optuna — tuning XGBoost (50 trials)...")

def xgb_objective(trial):
    params = {
        "n_estimators"    : trial.suggest_int("n_estimators", 100, 500),
        "max_depth"       : trial.suggest_int("max_depth", 2, 7),
        "learning_rate"   : trial.suggest_float("learning_rate", 0.01, 0.2),
        "subsample"       : trial.suggest_float("subsample", 0.6, 1.0),
        "colsample_bytree": trial.suggest_float("colsample_bytree", 0.5, 1.0),
        "min_child_weight": trial.suggest_int("min_child_weight", 1, 10),
        "gamma"           : trial.suggest_float("gamma", 0, 0.5),
        "scale_pos_weight": ratio,
        "eval_metric"     : "logloss",
        "random_state"    : 42,
        "verbosity"       : 0,
    }
    model = XGBClassifier(**params)
    return cross_val_score(model, X_train_bal, y_train_bal,
                           cv=cv, scoring="f1").mean()

study = optuna.create_study(direction="maximize",
                             sampler=optuna.samplers.TPESampler(seed=42))
study.optimize(xgb_objective, n_trials=50, show_progress_bar=False)

best_xgb_params = study.best_params
best_xgb_params.update({"scale_pos_weight": ratio,
                          "eval_metric": "logloss",
                          "random_state": 42,
                          "verbosity": 0})
print(f"  Best XGBoost CV F1 : {study.best_value:.2%}")
print(f"  Best params        : {best_xgb_params}")

# ── Define models — XGBoost uses tuned params ────────────────────
models = {
    "XGBoost": XGBClassifier(**best_xgb_params),

    "LightGBM": LGBMClassifier(
        n_estimators=200, max_depth=4, learning_rate=0.05,
        min_child_samples=5, num_leaves=15,
        class_weight="balanced", random_state=42, verbose=-1
    ),
    "RandomForest": RandomForestClassifier(
        n_estimators=200, max_depth=5,
        class_weight="balanced", random_state=42
    ),
    "ExtraTrees": ExtraTreesClassifier(
        n_estimators=200, max_depth=5,
        class_weight="balanced", random_state=42
    )
}

print("\nStep 3 — Base Models:")
trained_models = {}

for name, model in models.items():
    cv_f1    = cross_val_score(model, X_train_bal, y_train_bal,
                                cv=cv, scoring="f1").mean()
    model.fit(X_train_bal, y_train_bal)
    y_pred   = model.predict(X_test)
    test_acc = accuracy_score(y_test, y_pred)
    test_f1  = f1_score(y_test, y_pred)
    trained_models[name] = model
    print(f"  {name:<14} CV F1={cv_f1:.2%}  Test Acc={test_acc:.2%}  Test F1={test_f1:.2%}")

# Save models
models_dir = os.path.join(BASE, "models")
os.makedirs(models_dir, exist_ok=True)
for name, model in trained_models.items():
    joblib.dump(model, os.path.join(models_dir, f"{name.lower()}_model.pkl"))

# Save base predictions for meta-model
base_preds_train = pd.DataFrame({f"{n}_prob": m.predict_proba(X_train_bal)[:, 1]
                                  for n, m in trained_models.items()})
base_preds_test  = pd.DataFrame({f"{n}_prob": m.predict_proba(X_test)[:, 1]
                                  for n, m in trained_models.items()})

pd.Series(y_train_bal, name="Failure_Label").to_csv(
    os.path.join(BASE, "y_train_bal.csv"), index=False)
base_preds_train.to_csv(os.path.join(BASE, "base_preds_train.csv"), index=False)
base_preds_test.to_csv(os.path.join(BASE,  "base_preds_test.csv"),  index=False)

# Save best XGBoost params for reference
pd.DataFrame([best_xgb_params]).to_csv(
    os.path.join(BASE, "best_xgb_params.csv"), index=False)
