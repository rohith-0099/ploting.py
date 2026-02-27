"""
Phase 3 — Maintenance Impact Simulation
MECON Hackathon: AI-Driven Production Intelligence Platform

Two scenarios simulated:
  A) Preventive Now  — immediate PM at hour 0
  B) Delay Maintenance — no PM for 72 hours, then corrective if failure

Downtime linked to failure risk via expected value: E[DT] = p_h × downtime_if_failure
"""

import os
import matplotlib
matplotlib.use("Agg")

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import warnings
warnings.filterwarnings("ignore")

BASE      = os.path.dirname(os.path.abspath(__file__))
PHASE1    = os.path.join(BASE, "..", "phase 1")
PHASE2    = os.path.join(BASE, "..", "phase 2")

# ── Configuration ─────────────────────────────────────────────────
HORIZON_HOURS    = 168     # 1-week simulation window
DELAY_HOURS      = 72      # Scenario B delay before any maintenance
POST_PM_RISK_MULT = 0.15   # After preventive PM, residual risk drops to 15%
# Corrective maintenance (unplanned) takes 2× planned duration
CM_DURATION_MULT = 2.0

print("Phase 3: Two scenarios simulated: Preventive Now vs Delay")
print(f"  Horizon  : {HORIZON_HOURS}h (1 week)")
print(f"  Delay    : {DELAY_HOURS}h for Scenario B")
print("  Downtime linked to failure risk via: E[DT] = p_h × downtime_if_failure\n")

# ── Load inputs ───────────────────────────────────────────────────
machines  = pd.read_csv(os.path.join(PHASE1, "machines.csv"))
jobs      = pd.read_csv(os.path.join(PHASE1, "jobs.csv"))
costs_raw = pd.read_csv(os.path.join(PHASE1, "cost_parameters.csv"))
preds     = pd.read_csv(os.path.join(PHASE2, "predictions.csv"))

# ── Compute revenue rate per Machine_Type from jobs ───────────────
jobs["Rev_Rate"] = jobs["Revenue_Per_Job"] / jobs["Processing_Time_Hours"].replace(0, np.nan)
rev_rate = (jobs.groupby("Required_Machine_Type")["Rev_Rate"]
              .mean()
              .rename_axis("Machine_Type")
              .reset_index(name="Rev_Rate_Per_Hour"))

# ── Merge machines + predictions + cost + rev_rate ────────────────
df = machines.merge(preds[["Machine_ID", "Failure_Prob", "Health_Score", "Risk_Tier"]],
                    on="Machine_ID", how="left")
df = df.merge(costs_raw[["Machine_ID",
                          "Preventive_Maintenance_Cost",
                          "Corrective_Maintenance_Cost",
                          "Downtime_Cost_Per_Hour",
                          "Replacement_Cost",
                          "Maintenance_Duration_Hours"]],
              on="Machine_ID", how="left")
df = df.merge(rev_rate, on="Machine_Type", how="left")

# Fill missing rev_rate with overall mean
df["Rev_Rate_Per_Hour"] = df["Rev_Rate_Per_Hour"].fillna(df["Rev_Rate_Per_Hour"].mean())

# ── Per-machine derived values ────────────────────────────────────
# p_h: failure probability within the 1-week horizon (direct from Phase 2)
df["p_h"] = df["Failure_Prob"].clip(0, 1)

# Expected unplanned downtime if no PM: p_h × corrective_duration
df["CM_Downtime_Hours"] = df["Maintenance_Duration_Hours"] * CM_DURATION_MULT
# Also consider historical: max(8, weekly equivalent of last year's downtime)
df["CM_Downtime_Hours"] = df.apply(
    lambda r: max(r["CM_Downtime_Hours"],
                  max(8.0, r["Downtime_Hours_Last_Year"] / 52)),
    axis=1
)

# ── Scenario A: Preventive Now ────────────────────────────────────
df["A_Maintenance_Start_Hour"]  = 0
df["A_Maintenance_Planned"]     = 1
df["A_DT_Planned"]              = df["Maintenance_Duration_Hours"]
df["A_p_after"]                 = df["p_h"] * POST_PM_RISK_MULT
df["A_DT_Unplanned"]            = df["A_p_after"] * df["CM_Downtime_Hours"]
df["A_Expected_Downtime"]       = df["A_DT_Planned"] + df["A_DT_Unplanned"]
df["A_Maintenance_Cost"]        = df["Preventive_Maintenance_Cost"]
df["A_Downtime_Cost"]           = df["A_Expected_Downtime"] * df["Downtime_Cost_Per_Hour"]
df["A_Production_Loss"]         = df["A_Expected_Downtime"] * df["Rev_Rate_Per_Hour"]
df["A_Total_Cost"]              = (df["A_Maintenance_Cost"] +
                                   df["A_Downtime_Cost"] +
                                   df["A_p_after"] * df["Replacement_Cost"])

# ── Scenario B: Delay 72 Hours ────────────────────────────────────
df["B_Maintenance_Start_Hour"]  = DELAY_HOURS
df["B_Maintenance_Planned"]     = 0            # corrective if failure occurs
df["B_Expected_Downtime"]       = df["p_h"] * df["CM_Downtime_Hours"]
df["B_Maintenance_Cost"]        = df["p_h"] * df["Corrective_Maintenance_Cost"]
df["B_Downtime_Cost"]           = df["B_Expected_Downtime"] * df["Downtime_Cost_Per_Hour"]
df["B_Production_Loss"]         = df["B_Expected_Downtime"] * df["Rev_Rate_Per_Hour"]
df["B_Total_Cost"]              = (df["B_Maintenance_Cost"] +
                                   df["B_Downtime_Cost"] +
                                   df["p_h"] * df["Replacement_Cost"])

# ── Delta metrics (B - A = savings from doing PM now) ────────────
df["Delta_Downtime"]   = df["B_Expected_Downtime"] - df["A_Expected_Downtime"]
df["Delta_ProdLoss"]   = df["B_Production_Loss"]   - df["A_Production_Loss"]
df["Delta_TotalCost"]  = df["B_Total_Cost"]         - df["A_Total_Cost"]

def make_decision(row):
    if row["Delta_TotalCost"] > 0:
        return ("Preventive Now",
                f"High failure risk (p={row['p_h']:.2f}) makes delay expensive; "
                f"PM now saves ₹{row['Delta_TotalCost']:,.0f} and "
                f"{row['Delta_Downtime']:.1f}h downtime.")
    else:
        return ("Delay",
                f"Low failure risk (p={row['p_h']:.2f}); delay saves "
                f"₹{-row['Delta_TotalCost']:,.0f} with only "
                f"{abs(row['Delta_Downtime']):.1f}h extra expected downtime.")

df[["Decision", "Decision_Reason"]] = df.apply(
    make_decision, axis=1, result_type="expand")

# ── Build phase3_machine_scenarios.csv ───────────────────────────
rows = []
for _, row in df.iterrows():
    for scen, letter in [("Preventive Now", "A"), ("Delay 72h", "B")]:
        rows.append({
            "Machine_ID"               : row["Machine_ID"],
            "Machine_Type"             : row["Machine_Type"],
            "Failure_Prob"             : round(row["p_h"], 3),
            "Health_Score"             : row["Health_Score"],
            "Risk_Tier"                : row["Risk_Tier"],
            "Scenario_Name"            : scen,
            "Maintenance_Start_Hour"   : row[f"{letter}_Maintenance_Start_Hour"],
            "Maintenance_Planned"      : row[f"{letter}_Maintenance_Planned"],
            "Delay_Hours"              : 0 if letter == "A" else DELAY_HOURS,
            "Expected_Downtime_Hours"  : round(row[f"{letter}_Expected_Downtime"], 2),
            "Expected_Maintenance_Cost": round(row[f"{letter}_Maintenance_Cost"], 2),
            "Expected_Downtime_Cost"   : round(row[f"{letter}_Downtime_Cost"], 2),
            "Expected_Production_Loss" : round(row[f"{letter}_Production_Loss"], 2),
            "Expected_Total_Cost"      : round(row[f"{letter}_Total_Cost"], 2),
            "Decision"                 : row["Decision"],
            "Decision_Reason"          : row["Decision_Reason"],
        })

scenarios_df = pd.DataFrame(rows)
scenarios_df.to_csv(os.path.join(BASE, "phase3_machine_scenarios.csv"), index=False)

# ── Build phase3_summary.csv ──────────────────────────────────────
summary = (scenarios_df.groupby("Scenario_Name")
           .agg(
               Total_Expected_Downtime_Hours  = ("Expected_Downtime_Hours",  "sum"),
               Total_Expected_Production_Loss = ("Expected_Production_Loss", "sum"),
               Total_Expected_Maintenance_Cost= ("Expected_Maintenance_Cost","sum"),
               Total_Expected_Downtime_Cost   = ("Expected_Downtime_Cost",   "sum"),
               Total_Expected_Total_Cost      = ("Expected_Total_Cost",       "sum"),
           )
           .reset_index()
           .round(2))

summary.to_csv(os.path.join(BASE, "phase3_summary.csv"), index=False)

# ── Print console summary ─────────────────────────────────────────
print("── Scenario Totals (All 500 Machines) ──────────────────────")
for _, r in summary.iterrows():
    print(f"\n  {r['Scenario_Name']}")
    print(f"    Total Downtime        : {r['Total_Expected_Downtime_Hours']:>10,.1f} hrs")
    print(f"    Total Production Loss : {r['Total_Expected_Production_Loss']:>10,.0f}")
    print(f"    Total Maintenance Cost: {r['Total_Expected_Maintenance_Cost']:>10,.0f}")
    print(f"    Total Downtime Cost   : {r['Total_Expected_Downtime_Cost']:>10,.0f}")
    print(f"    Total Cost            : {r['Total_Expected_Total_Cost']:>10,.0f}")

# Top 10 machines where PM-now saves most cost
top10 = (df.nlargest(10, "Delta_TotalCost")
          [["Machine_ID", "Machine_Type", "p_h",
            "Delta_TotalCost", "Delta_Downtime", "Risk_Tier"]]
          .round(2))
print(f"\n── Top 10 Machines Where Preventive Now Saves Most Cost ────")
print(top10.to_string(index=False))

pm_recommended = (df["Decision"] == "Preventive Now").sum()
delay_recommended = (df["Decision"] == "Delay").sum()
print(f"\n── Recommendations ─────────────────────────────────────────")
print(f"  Preventive Now recommended : {pm_recommended}/500 machines")
print(f"  Delay recommended          : {delay_recommended}/500 machines")

# ── Plot: phase3_scenario_comparison.png ─────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(16, 6))
fig.suptitle("Phase 3 — Maintenance Scenario Comparison\n(Preventive Now vs Delay 72h)",
             fontsize=14, fontweight="bold")

scenarios  = summary["Scenario_Name"].tolist()
colors     = ["#2ecc71", "#e74c3c"]

# Bar 1: Total Cost
axes[0].bar(scenarios,
            summary["Total_Expected_Total_Cost"] / 1e6,
            color=colors)
axes[0].set_title("Total Expected Cost (₹M)", fontweight="bold")
axes[0].set_ylabel("₹ Millions")
for i, v in enumerate(summary["Total_Expected_Total_Cost"]):
    axes[0].text(i, v/1e6 + 0.01*v/1e6, f"₹{v/1e6:.1f}M",
                 ha="center", fontweight="bold", fontsize=10)
axes[0].grid(True, alpha=0.3, axis="y")

# Bar 2: Total Downtime
axes[1].bar(scenarios,
            summary["Total_Expected_Downtime_Hours"],
            color=colors)
axes[1].set_title("Total Expected Downtime (hrs)", fontweight="bold")
axes[1].set_ylabel("Hours")
for i, v in enumerate(summary["Total_Expected_Downtime_Hours"]):
    axes[1].text(i, v + 0.5, f"{v:.0f}h", ha="center", fontweight="bold", fontsize=10)
axes[1].grid(True, alpha=0.3, axis="y")

# Bar 3: Total Production Loss
axes[2].bar(scenarios,
            summary["Total_Expected_Production_Loss"] / 1e6,
            color=colors)
axes[2].set_title("Total Production Loss (₹M)", fontweight="bold")
axes[2].set_ylabel("₹ Millions")
for i, v in enumerate(summary["Total_Expected_Production_Loss"]):
    axes[2].text(i, v/1e6 + 0.01*v/1e6, f"₹{v/1e6:.1f}M",
                 ha="center", fontweight="bold", fontsize=10)
axes[2].grid(True, alpha=0.3, axis="y")

plt.tight_layout()
plt.savefig(os.path.join(BASE, "phase3_scenario_comparison.png"), dpi=150, bbox_inches="tight")
plt.close()

print("\nSaved phase3_machine_scenarios.csv")
print("Saved phase3_summary.csv")
print("Saved phase3_scenario_comparison.png")
print("Phase 3 Complete!")
