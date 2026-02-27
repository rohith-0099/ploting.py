import os
import matplotlib
matplotlib.use("Agg")   # non-blocking — saves PNGs without opening windows

import warnings
warnings.filterwarnings("ignore")

import pandas as pd
import numpy as np
import joblib
import shap
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

BASE = os.path.dirname(os.path.abspath(__file__))

# Load
X_train     = pd.read_csv(os.path.join(BASE, "X_train.csv"))
X_test      = pd.read_csv(os.path.join(BASE, "X_test.csv"))
base_te     = pd.read_csv(os.path.join(BASE, "base_preds_test.csv"))
xgb_model   = joblib.load(os.path.join(BASE, "models", "xgboost_model.pkl"))
meta_model  = joblib.load(os.path.join(BASE, "models", "meta_model.pkl"))
threshold   = pd.read_csv(os.path.join(BASE, "best_threshold.csv"))["best_threshold"].iloc[0]
meta_prob   = meta_model.predict_proba(base_te)[:, 1]

feature_names = X_test.columns.tolist()

# ── Build SHAP explainer on training data (correct practice) ─────
# Using X_train background lets SHAP understand the baseline distribution
explainer   = shap.TreeExplainer(xgb_model, data=X_train,
                                  feature_perturbation="interventional")
shap_values = explainer.shap_values(X_test)

print(f"SHAP values computed — shape: {shap_values.shape}")

# ────────────────────────────────────────────────────────────────
# PLOT 1 — SHAP Summary (Beeswarm)
# Shows direction AND magnitude for every machine + every feature
# Red dots = high feature value, Blue = low feature value
# X-axis = how much it pushed the prediction toward failure
# ────────────────────────────────────────────────────────────────
plt.figure(figsize=(11, 8))
shap.summary_plot(shap_values, X_test, feature_names=feature_names,
                  show=False, plot_size=None, alpha=0.7)
plt.title("SHAP Beeswarm — Feature Impact on Failure Probability\n"
          "(Red = high value  |  Blue = low value  |  X-axis = impact on output)",
          fontsize=12, fontweight="bold", pad=12)
plt.tight_layout()
plt.savefig(os.path.join(BASE, "shap_summary.png"), dpi=150, bbox_inches="tight")
plt.close()
print("Saved shap_summary.png")

# ────────────────────────────────────────────────────────────────
# PLOT 2 — SHAP Bar (Global importance ranking)
# Clean bar chart — most useful for slide decks + judge presentations
# ────────────────────────────────────────────────────────────────
plt.figure(figsize=(10, 7))
shap.summary_plot(shap_values, X_test, feature_names=feature_names,
                  plot_type="bar", show=False)
plt.title("SHAP Feature Importance — Mean |SHAP| Across 100 Test Machines",
          fontsize=12, fontweight="bold", pad=12)
plt.tight_layout()
plt.savefig(os.path.join(BASE, "shap_bar.png"), dpi=150, bbox_inches="tight")
plt.close()
print("Saved shap_bar.png")

# ────────────────────────────────────────────────────────────────
# PLOT 3 — Paired Waterfall: Critical vs Healthy
# Shows EXACTLY why one machine is predicted as failing
# and why another is predicted as healthy — side by side
# ────────────────────────────────────────────────────────────────
critical_idx = int(np.argmax(meta_prob))
healthy_idx  = int(np.argmin(meta_prob))

fig, axes = plt.subplots(1, 2, figsize=(18, 8))
fig.suptitle("SHAP Waterfall — Why the Model Made Each Decision",
             fontsize=14, fontweight="bold")

for ax, idx, label, color in [
    (axes[0], critical_idx, "Most Critical Machine", "#d62728"),
    (axes[1], healthy_idx,  "Healthiest Machine",    "#2ca02c"),
]:
    plt.sca(ax)
    exp = shap.Explanation(
        values        = shap_values[idx],
        base_values   = float(explainer.expected_value),
        data          = X_test.iloc[idx].values,
        feature_names = feature_names
    )
    shap.plots.waterfall(exp, show=False, max_display=10)
    ax.set_title(
        f"{label}\n"
        f"Failure Prob = {meta_prob[idx]:.3f}  |  "
        f"Health Score = {(1-meta_prob[idx])*100:.1f}",
        fontsize=11, fontweight="bold", color=color
    )

plt.tight_layout()
plt.savefig(os.path.join(BASE, "shap_waterfall_pair.png"), dpi=150, bbox_inches="tight")
plt.close()
print("Saved shap_waterfall_pair.png")

# ────────────────────────────────────────────────────────────────
# PLOT 4 — SHAP Dependence: Top 2 most impactful features
# Shows how a single feature value drives failure probability
# Dots colored by an interaction feature (auto-selected by SHAP)
# ────────────────────────────────────────────────────────────────
mean_abs_shap = np.abs(shap_values).mean(axis=0)
top2_idx      = np.argsort(mean_abs_shap)[::-1][:2]

fig, axes = plt.subplots(1, 2, figsize=(14, 6))
fig.suptitle("SHAP Dependence — How Top Features Drive Failure Risk",
             fontsize=13, fontweight="bold")

for ax, fi in zip(axes, top2_idx):
    feat   = feature_names[fi]
    shap.dependence_plot(
        feat, shap_values, X_test,
        feature_names=feature_names,
        ax=ax, show=False, alpha=0.7
    )
    ax.set_title(f"{feat}", fontsize=11, fontweight="bold")
    ax.grid(True, alpha=0.3)

plt.tight_layout()
plt.savefig(os.path.join(BASE, "shap_dependence.png"), dpi=150, bbox_inches="tight")
plt.close()
print("Saved shap_dependence.png")

# ────────────────────────────────────────────────────────────────
# TEXT — Per-Machine SHAP Explanation (human-readable for judges)
# ────────────────────────────────────────────────────────────────
def explain_machine(idx, label):
    machine_shap  = shap_values[idx]
    machine_data  = X_test.iloc[idx]
    prob          = meta_prob[idx]
    health        = round((1 - prob) * 100, 1)
    verdict       = "AT RISK" if prob >= threshold else "HEALTHY"
    sorted_fi     = np.argsort(np.abs(machine_shap))[::-1]

    print(f"\n{label}")
    print(f"  Failure Probability : {prob:.3f}   Health Score: {health}   {verdict}")
    print(f"  Top drivers:")
    for rank, fi in enumerate(sorted_fi[:5], 1):
        direction = "→ pushes TOWARD failure" if machine_shap[fi] > 0 \
                    else "→ pushes TOWARD healthy"
        print(f"    {rank}. {feature_names[fi]:<28} val={machine_data.iloc[fi]:.2f}"
              f"   SHAP={machine_shap[fi]:+.4f}   {direction}")

print("\nPer-Machine SHAP Explanations")
explain_machine(critical_idx, "MOST CRITICAL MACHINE")
explain_machine(healthy_idx,  "HEALTHIEST MACHINE")

# Global feature ranking table   
print("\nGlobal Feature Ranking (Mean |SHAP|)")
ranking = sorted(zip(feature_names, mean_abs_shap), key=lambda x: -x[1])
for rank, (feat, score) in enumerate(ranking, 1):
    bar = "█" * int(score * 100)
    print(f"  {rank:>2}. {feat:<28} {bar} {score:.4f}")

# Save SHAP values as CSV    
shap_df = pd.DataFrame(shap_values, columns=[f"SHAP_{c}" for c in feature_names])
shap_df.insert(0, "Test_Index", range(len(shap_df)))
shap_df.to_csv(os.path.join(BASE, "shap_values.csv"), index=False)

print(f"\nSaved shap_values.csv  {shap_df.shape}")
print("PHASE 2 COMPLETE — 4 SHAP plots + explanations + CSV saved")
