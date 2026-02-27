import os
import matplotlib
matplotlib.use("Agg")   # non-interactive — saves PNG without opening a window
import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    confusion_matrix, roc_curve, auc,
    ConfusionMatrixDisplay, f1_score,
    accuracy_score, precision_score,
    recall_score, classification_report
)

BASE = os.path.dirname(os.path.abspath(__file__))

X_test     = pd.read_csv(os.path.join(BASE, "X_test.csv"))
y_test     = pd.read_csv(os.path.join(BASE, "y_test.csv")).squeeze()
base_te    = pd.read_csv(os.path.join(BASE, "base_preds_test.csv"))
meta_model = joblib.load(os.path.join(BASE, "models", "meta_model.pkl"))
xgb_model  = joblib.load(os.path.join(BASE, "models", "xgboost_model.pkl"))
threshold  = pd.read_csv(os.path.join(BASE, "best_threshold.csv"))["best_threshold"].iloc[0]

meta_prob = meta_model.predict_proba(base_te)[:, 1]
meta_pred = (meta_prob >= threshold).astype(int)

print("Classification Report ")
print(classification_report(y_test, meta_pred, target_names=["Healthy (0)", "At Risk (1)"]))

fpr, tpr, _ = roc_curve(y_test, meta_prob)
roc_auc     = auc(fpr, tpr)
print(f"   AUC-ROC : {roc_auc:.4f}")

cm = confusion_matrix(y_test, meta_pred)
tn, fp, fn, tp = cm.ravel()
print(f"\nConfusion Matrix ")
print(f"   TP (caught failures)  : {tp}")
print(f"   TN (correct healthy)  : {tn}")
print(f"   FP (false alarms)     : {fp}")
print(f"   FN (missed failures)  : {fn}")

fig, axes = plt.subplots(2, 2, figsize=(14, 11))
fig.suptitle("Phase 2 — Model Evaluation Dashboard",
             fontsize=16, fontweight="bold", y=1.01)

# Plot 1: Confusion Matrix
disp = ConfusionMatrixDisplay(confusion_matrix=cm,
                               display_labels=["Healthy", "At Risk"])
disp.plot(ax=axes[0, 0], colorbar=False, cmap="Blues")
axes[0, 0].set_title("Confusion Matrix", fontsize=13, fontweight="bold")
axes[0, 0].set_xlabel(
    f"TN={tn}  |  FP={fp}  |  FN={fn}  |  TP={tp}\n"
    f"Caught {tp} of {tp+fn} real failures ({tp/(tp+fn)*100:.1f}% recall)",
    fontsize=9
)

# Plot 2: ROC Curve
axes[0, 1].plot(fpr, tpr, color="darkorange", lw=2,
                label=f"Stacked Ensemble  AUC = {roc_auc:.3f}")
axes[0, 1].plot([0, 1], [0, 1], color="navy", lw=1,
                linestyle="--", label="Random Classifier  AUC = 0.500")
axes[0, 1].fill_between(fpr, tpr, alpha=0.15, color="darkorange")
axes[0, 1].set_xlim([0.0, 1.0])
axes[0, 1].set_ylim([0.0, 1.05])
axes[0, 1].set_xlabel("False Positive Rate", fontsize=11)
axes[0, 1].set_ylabel("True Positive Rate (Recall)", fontsize=11)
axes[0, 1].set_title("ROC Curve", fontsize=13, fontweight="bold")
axes[0, 1].legend(loc="lower right", fontsize=9)
axes[0, 1].grid(True, alpha=0.3)

# Plot 3: Feature Importance
feature_names   = X_test.columns.tolist()
importances     = xgb_model.feature_importances_
sorted_idx      = np.argsort(importances)
sorted_features = [feature_names[i] for i in sorted_idx]
sorted_imp      = importances[sorted_idx]

colors = ["#d62728" if i >= len(sorted_features) - 5 else "#1f77b4"
          for i in range(len(sorted_features))]

axes[1, 0].barh(sorted_features, sorted_imp, color=colors)
axes[1, 0].set_title("Feature Importance (XGBoost)", fontsize=13, fontweight="bold")
axes[1, 0].set_xlabel("Importance Score", fontsize=11)
axes[1, 0].axvline(x=np.mean(importances), color="red",
                   linestyle="--", alpha=0.5, label="Mean")
axes[1, 0].legend(fontsize=9)
axes[1, 0].grid(True, alpha=0.3, axis="x")

print(f"\nTop 5 Features (XGBoost)")
for i in range(1, 6):
    idx = sorted_idx[-i]
    print(f"   #{i}: {feature_names[idx]:<30} {importances[idx]:.4f}")

# Plot 4: Threshold Tuning Curve
thresholds_range = np.arange(0.10, 0.90, 0.01)
f1_scores, acc_scores, rec_scores, prec_scores = [], [], [], []

for t in thresholds_range:
    pred = (meta_prob >= t).astype(int)
    f1_scores.append(f1_score(y_test, pred, zero_division=0))
    acc_scores.append(accuracy_score(y_test, pred))
    rec_scores.append(recall_score(y_test, pred, zero_division=0))
    prec_scores.append(precision_score(y_test, pred, zero_division=0))

axes[1, 1].plot(thresholds_range, f1_scores,   label="F1 Score",  color="blue",   lw=2)
axes[1, 1].plot(thresholds_range, acc_scores,  label="Accuracy",  color="green",  lw=2)
axes[1, 1].plot(thresholds_range, rec_scores,  label="Recall",    color="red",    lw=1.5, linestyle="--")
axes[1, 1].plot(thresholds_range, prec_scores, label="Precision", color="orange", lw=1.5, linestyle="--")
axes[1, 1].axvline(x=threshold, color="black", linestyle=":", lw=2.5,
                   label=f"Chosen = {threshold:.2f}")
axes[1, 1].set_xlabel("Decision Threshold", fontsize=11)
axes[1, 1].set_ylabel("Score", fontsize=11)
axes[1, 1].set_title("Threshold Tuning Curve", fontsize=13, fontweight="bold")
axes[1, 1].legend(fontsize=9)
axes[1, 1].grid(True, alpha=0.3)
axes[1, 1].set_ylim([0, 1.05])

plt.tight_layout()
plt.savefig(os.path.join(BASE, "evaluation_dashboard.png"), dpi=150, bbox_inches="tight")
plt.show()

print("\n── Final Metrics Summary ───────────────────────────────────")
print(f"   AUC-ROC   : {roc_auc:.4f}")
print(f"   Accuracy  : {accuracy_score(y_test, meta_pred):.2%}")
print(f"   F1 Score  : {f1_score(y_test, meta_pred):.2%}")
print(f"   Precision : {precision_score(y_test, meta_pred):.2%}")
print(f"   Recall    : {recall_score(y_test, meta_pred):.2%}")
print(f"   Threshold : {threshold:.2f}")
print(f"   TP={tp}  TN={tn}  FP={fp}  FN={fn}")

# RMSE and MAE — on all 500 machines from predictions.csv
preds_df = pd.read_csv(os.path.join(BASE, "predictions.csv"))
rmse = np.sqrt(((preds_df["Actual_Label"] - preds_df["Failure_Prob"])**2).mean())
mae  = (preds_df["Actual_Label"] - preds_df["Failure_Prob"]).abs().mean()
print(f"   RMSE      : {rmse:.4f}  (prob vs actual, all 500 machines)")
print(f"   MAE       : {mae:.4f}  (avg error = {mae*100:.1f}%)")
print("\n✅ evaluation_dashboard.png saved")
