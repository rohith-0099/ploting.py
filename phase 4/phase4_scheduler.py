"""
Phase 4 — Multi-Objective Job Scheduling Optimization (25 marks)
MECON Hackathon: AI-Driven Production Intelligence Platform

Objective Function per (machine m, job j) pair:
    Score(m,j) = w1 * T(m,j) - w2 * R(m) - w3 * C(m)

Where:
    T(m,j) = throughput value (normalized revenue × priority)
    R(m)   = failure risk  (Phase 2 Failure_Prob)
    C(m)   = maintenance cost risk (Phase 3 normalized expected cost)
    w1 + w2 + w3 = 1.0

Hard Constraints:
    1. Machine type must match Required_Machine_Type
    2. Machine must have enough available hours (capacity constraint)
    3. job_start + Processing_Time <= Deadline_Hours
    4. Maintenance window is blocked — no jobs during PM hours
    5. Each job assigned to exactly one machine (no splitting)
"""

import os
import matplotlib
matplotlib.use("Agg")
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import warnings
warnings.filterwarnings("ignore")

BASE   = os.path.dirname(os.path.abspath(__file__))
PHASE1 = os.path.join(BASE, "..", "phase 1")
PHASE2 = os.path.join(BASE, "..", "phase 2")
PHASE3 = os.path.join(BASE, "..", "phase 3")

HORIZON_HOURS = 168   # 1-week scheduling window

# ── Weight configurations for sensitivity analysis ─────────────────
WEIGHT_CONFIGS = [
    {"label": "Throughput Focus",  "w1": 1.00, "w2": 0.00, "w3": 0.00},
    {"label": "Safety Focus",      "w1": 0.00, "w2": 1.00, "w3": 0.00},
    {"label": "Cost Focus",        "w1": 0.00, "w2": 0.00, "w3": 1.00},
    {"label": "Balanced Default",  "w1": 0.50, "w2": 0.30, "w3": 0.20},
    {"label": "Equal Weights",     "w1": 0.33, "w2": 0.34, "w3": 0.33},
]
DEFAULT_WEIGHTS = WEIGHT_CONFIGS[3]   # Balanced Default

# ── Load data ─────────────────────────────────────────────────────
machines  = pd.read_csv(os.path.join(PHASE1, "machines.csv"))
jobs      = pd.read_csv(os.path.join(PHASE1, "jobs.csv"))
costs_raw = pd.read_csv(os.path.join(PHASE1, "cost_parameters.csv"))
preds     = pd.read_csv(os.path.join(PHASE2, "predictions.csv"))
phase3    = pd.read_csv(os.path.join(PHASE3, "phase3_machine_scenarios.csv"))

# Phase 3 Preventive Now row per machine → maintenance window + cost
p3_pm = phase3[phase3["Scenario_Name"] == "Preventive Now"].copy()

# ── Build master machine table ────────────────────────────────────
mach = (machines
        .merge(preds[["Machine_ID","Failure_Prob","Health_Score","Risk_Tier"]],
               on="Machine_ID", how="left")
        .merge(costs_raw[["Machine_ID","Preventive_Maintenance_Cost",
                           "Corrective_Maintenance_Cost",
                           "Downtime_Cost_Per_Hour","Maintenance_Duration_Hours"]],
               on="Machine_ID", how="left")
        .merge(p3_pm[["Machine_ID","Maintenance_Start_Hour",
                       "Expected_Maintenance_Cost","Expected_Downtime_Hours"]],
               on="Machine_ID", how="left"))

# ── Normalize R(m) and C(m) to [0,1] ─────────────────────────────
mach["R_m"] = mach["Failure_Prob"].fillna(0)  # already 0-1 from Phase 2
cost_max    = mach["Expected_Maintenance_Cost"].max()
mach["C_m"] = (mach["Expected_Maintenance_Cost"].fillna(0) / cost_max).clip(0, 1)

# ── Machine available hours per week ─────────────────────────────
# Total = Daily_Operating_Hours × 7 − maintenance downtime
mach["Total_Available_Hours"] = (mach["Daily_Operating_Hours"] * 7
                                 - mach["Expected_Downtime_Hours"].fillna(0)).clip(0, None)

# ── Maintenance window: blocked hours (start → start + duration) ──
mach["Maint_Start"] = mach["Maintenance_Start_Hour"].fillna(0)
mach["Maint_End"]   = mach["Maint_Start"] + mach["Maintenance_Duration_Hours"].fillna(0)

# ── Normalize job throughput T(m,j) components ───────────────────
rev_max      = jobs["Revenue_Per_Job"].max()
pri_max      = jobs["Priority_Level"].max()   # higher number = lower priority

jobs["Rev_norm"]  = jobs["Revenue_Per_Job"] / rev_max
# Priority: Level 1 = most important → score 1.0; Level 5 = least → score 0.2
jobs["Pri_norm"]  = 1 - (jobs["Priority_Level"] - 1) / (pri_max - 1 + 1e-9)
jobs["T_j"]       = (jobs["Rev_norm"] * 0.6 + jobs["Pri_norm"] * 0.4).clip(0, 1)


def run_scheduler(w1, w2, w3, label=""):
    """
    Run the multi-objective scheduler with given weights.
    Returns (schedule_df, deferred_df, summary_dict)
    """
    # Per-machine state: used hours and current timeline pointer
    machine_used   = {mid: 0.0 for mid in mach["Machine_ID"]}
    machine_cursor = {mid: mach.loc[mach["Machine_ID"]==mid, "Maint_End"].values[0]
                      if mach.loc[mach["Machine_ID"]==mid, "Maint_Start"].values[0] == 0
                      else 0.0
                      for mid in mach["Machine_ID"]}

    # Sort jobs: highest priority (1) first, then highest revenue
    jobs_sorted = jobs.sort_values(
        ["Priority_Level", "Revenue_Per_Job"],
        ascending=[True, False]
    ).reset_index(drop=True)

    schedule = []
    deferred = []

    for _, job in jobs_sorted.iterrows():
        jid       = job["Job_ID"]
        jtype     = job["Required_Machine_Type"]
        jprocess  = job["Processing_Time_Hours"]
        jdeadline = job["Deadline_Hours"]
        jrev      = job["Revenue_Per_Job"]
        t_j       = job["T_j"]

        # Candidate machines of matching type
        candidates = mach[mach["Machine_Type"] == jtype].copy()

        if candidates.empty:
            deferred.append({"Job_ID": jid,
                             "Reason": f"No machine of type '{jtype}' exists in fleet"})
            continue

        scored = []
        for _, m in candidates.iterrows():
            mid       = m["Machine_ID"]
            r_m       = m["R_m"]
            c_m       = m["C_m"]
            avail     = m["Total_Available_Hours"]
            used      = machine_used[mid]
            cursor    = machine_cursor[mid]

            # Objective score
            score = w1 * t_j - w2 * r_m - w3 * c_m

            # Constraint 1: Capacity
            if used + jprocess > avail:
                continue

            # Constraint 2: Deadline
            start_hour = cursor
            end_hour   = start_hour + jprocess
            if end_hour > jdeadline:
                continue

            # Constraint 3: Maintenance window check
            m_start = m["Maint_Start"]
            m_end   = m["Maint_End"]
            if not (end_hour <= m_start or start_hour >= m_end):
                # Overlap with maintenance — push start after maint_end
                start_hour = m_end
                end_hour   = start_hour + jprocess
                if end_hour > jdeadline:
                    continue   # still can't meet deadline after maintenance window

            scored.append({
                "Machine_ID" : mid,
                "Machine_Type": m["Machine_Type"],
                "Risk_Tier"  : m["Risk_Tier"],
                "Score"      : score,
                "Start_Hour" : start_hour,
                "End_Hour"   : end_hour,
                "R_m"        : r_m,
                "C_m"        : c_m,
            })

        if not scored:
            # Build reason
            cap_ok  = any(machine_used[m["Machine_ID"]] + jprocess
                          <= m["Total_Available_Hours"]
                          for _, m in candidates.iterrows())
            dead_ok = jdeadline >= jprocess
            if not dead_ok:
                reason = f"Deadline {jdeadline}h too tight for {jprocess}h job"
            elif not cap_ok:
                reason = f"All {jtype} machines over capacity"
            else:
                reason = (f"All {jtype} machines violate deadline or "
                          f"blocked by maintenance; w2={w2:.2f} risk filter active")
            deferred.append({"Job_ID": jid, "Reason": reason})
            continue

        # Pick best-scoring machine
        best = max(scored, key=lambda x: x["Score"])
        mid  = best["Machine_ID"]

        machine_used[mid]   += jprocess
        machine_cursor[mid]  = best["End_Hour"]

        schedule.append({
            "Job_ID"          : jid,
            "Machine_ID"      : mid,
            "Machine_Type"    : best["Machine_Type"],
            "Risk_Tier"       : best["Risk_Tier"],
            "Start_Hour"      : round(best["Start_Hour"], 2),
            "End_Hour"        : round(best["End_Hour"],   2),
            "Revenue"         : jrev,
            "Priority_Level"  : job["Priority_Level"],
            "Failure_Risk_Rm" : round(best["R_m"], 3),
            "Maint_Cost_Cm"   : round(best["C_m"], 3),
            "Allocation_Score": round(best["Score"], 4),
            "Decision_Reason" : (f"Best score={best['Score']:.4f} among "
                                 f"{len(scored)} valid {jtype} machines; "
                                 f"Risk={best['R_m']:.2f}, Cost={best['C_m']:.2f}"),
        })

    sched_df    = pd.DataFrame(schedule)
    deferred_df = pd.DataFrame(deferred)

    total_rev      = sched_df["Revenue"].sum()       if not sched_df.empty else 0
    total_risk_avg = sched_df["Failure_Risk_Rm"].mean() if not sched_df.empty else 0
    total_cost_avg = sched_df["Maint_Cost_Cm"].mean()   if not sched_df.empty else 0

    summary = {
        "Weight_Label"         : label,
        "w1_throughput"        : w1,
        "w2_risk"              : w2,
        "w3_cost"              : w3,
        "Jobs_Scheduled"       : len(sched_df),
        "Jobs_Deferred"        : len(deferred_df),
        "Total_Revenue"        : round(total_rev, 2),
        "Avg_Machine_Risk"     : round(total_risk_avg, 4),
        "Avg_Machine_Cost_Norm": round(total_cost_avg, 4),
    }
    return sched_df, deferred_df, summary


# ── Run default schedule (Balanced) ──────────────────────────────
print("Phase 4 — Multi-Objective Scheduling Optimization")
print(f"  Objective: Score(m,j) = w1*T(m,j) - w2*R(m) - w3*C(m)")
print(f"  Constraints: type match, capacity, deadline, maintenance window\n")

w = DEFAULT_WEIGHTS
sched_df, deferred_df, summary = run_scheduler(w["w1"], w["w2"], w["w3"], w["label"])

print(f"Default Schedule — {w['label']} (w1={w['w1']}, w2={w['w2']}, w3={w['w3']})")
print(f"  Jobs Scheduled : {summary['Jobs_Scheduled']}/200")
print(f"  Jobs Deferred  : {summary['Jobs_Deferred']}")
print(f"  Total Revenue  : {summary['Total_Revenue']:,.2f}")
print(f"  Avg Risk (Rm)  : {summary['Avg_Machine_Risk']:.4f}")

# Save default schedule outputs
sched_df.to_csv(os.path.join(BASE, "phase4_schedule.csv"), index=False)
deferred_df.to_csv(os.path.join(BASE, "phase4_deferred_jobs.csv"), index=False)

summary_df = pd.DataFrame([{
    "Total_Revenue"       : summary["Total_Revenue"],
    "Jobs_Scheduled"      : summary["Jobs_Scheduled"],
    "Jobs_Deferred"       : summary["Jobs_Deferred"],
    "Avg_Machine_Risk"    : summary["Avg_Machine_Risk"],
    "Avg_Cost_Norm"       : summary["Avg_Machine_Cost_Norm"],
    "Weight_Config"       : w["label"],
}])
summary_df.to_csv(os.path.join(BASE, "phase4_summary.csv"), index=False)

# ── Weight sensitivity analysis ───────────────────────────────────
print("\n── Weight Sensitivity Analysis ─────────────────────────────")
sensitivity_rows = []
for cfg in WEIGHT_CONFIGS:
    s, d, summ = run_scheduler(cfg["w1"], cfg["w2"], cfg["w3"], cfg["label"])
    sensitivity_rows.append(summ)
    print(f"  {cfg['label']:<20} | Scheduled={summ['Jobs_Scheduled']:>3} "
          f"| Revenue={summ['Total_Revenue']:>10,.0f} "
          f"| AvgRisk={summ['Avg_Machine_Risk']:.3f} "
          f"| AvgCost={summ['Avg_Machine_Cost_Norm']:.3f}")

sens_df = pd.DataFrame(sensitivity_rows)
sens_df.to_csv(os.path.join(BASE, "phase4_weight_sensitivity.csv"), index=False)

# ── Plot 1: Weight Sensitivity Comparison ─────────────────────────
fig, axes = plt.subplots(1, 3, figsize=(16, 6))
fig.suptitle("Phase 4 — Weight Sensitivity Analysis\n"
             "How changing w1/w2/w3 changes the schedule",
             fontsize=13, fontweight="bold")

labels  = [r["Weight_Label"] for r in sensitivity_rows]
colors  = ["#3498db","#e74c3c","#2ecc71","#f39c12","#9b59b6"]
x_pos   = np.arange(len(labels))

axes[0].bar(x_pos, [r["Jobs_Scheduled"] for r in sensitivity_rows], color=colors)
axes[0].set_xticks(x_pos); axes[0].set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
axes[0].set_title("Jobs Scheduled", fontweight="bold")
axes[0].set_ylabel("Count"); axes[0].grid(True, alpha=0.3, axis="y")
for i, v in enumerate([r["Jobs_Scheduled"] for r in sensitivity_rows]):
    axes[0].text(i, v+0.5, str(v), ha="center", fontsize=9, fontweight="bold")

axes[1].bar(x_pos, [r["Total_Revenue"]/1e3 for r in sensitivity_rows], color=colors)
axes[1].set_xticks(x_pos); axes[1].set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
axes[1].set_title("Total Revenue (₹K)", fontweight="bold")
axes[1].set_ylabel("₹ Thousands"); axes[1].grid(True, alpha=0.3, axis="y")

axes[2].bar(x_pos, [r["Avg_Machine_Risk"] for r in sensitivity_rows], color=colors)
axes[2].set_xticks(x_pos); axes[2].set_xticklabels(labels, rotation=20, ha="right", fontsize=9)
axes[2].set_title("Avg Machine Risk (Rm)", fontweight="bold")
axes[2].set_ylabel("Failure Probability"); axes[2].grid(True, alpha=0.3, axis="y")

plt.tight_layout()
plt.savefig(os.path.join(BASE, "phase4_sensitivity_chart.png"), dpi=150, bbox_inches="tight")
plt.close()

# ── Plot 2: Gantt-style Schedule Chart ────────────────────────────
if not sched_df.empty:
    # Show top 30 jobs for readability
    sample = sched_df.head(40).copy()
    machine_ids = sample["Machine_ID"].unique()
    mach_y  = {mid: i for i, mid in enumerate(machine_ids)}

    risk_colors = {
        "Critical"  : "#d62728",
        "High Risk" : "#ff7f0e",
        "At Risk"   : "#ffdd57",
        "Monitor"   : "#1f77b4",
        "Healthy"   : "#2ca02c",
    }

    fig, ax = plt.subplots(figsize=(16, max(6, len(machine_ids) * 0.45)))
    for _, row in sample.iterrows():
        y     = mach_y[row["Machine_ID"]]
        color = risk_colors.get(row["Risk_Tier"], "#aaaaaa")
        ax.barh(y, row["End_Hour"] - row["Start_Hour"],
                left=row["Start_Hour"], height=0.6,
                color=color, edgecolor="white", linewidth=0.5)
        ax.text(row["Start_Hour"] + (row["End_Hour"]-row["Start_Hour"])/2,
                y, row["Job_ID"], ha="center", va="center",
                fontsize=6, color="white", fontweight="bold")

    ax.set_yticks(list(mach_y.values()))
    ax.set_yticklabels(list(mach_y.keys()), fontsize=8)
    ax.set_xlabel("Hour within 168h horizon", fontsize=11)
    ax.set_title(f"Phase 4 — Schedule Gantt\n"
                 f"Balanced Default: w1={w['w1']}, w2={w['w2']}, w3={w['w3']}  "
                 f"| {summary['Jobs_Scheduled']} jobs scheduled",
                 fontsize=12, fontweight="bold")
    ax.set_xlim(0, HORIZON_HOURS)
    ax.axvline(x=HORIZON_HOURS, color="black", linestyle="--", alpha=0.5)
    ax.grid(True, alpha=0.2, axis="x")

    patches = [mpatches.Patch(color=c, label=l)
               for l, c in risk_colors.items()]
    ax.legend(handles=patches, loc="lower right", fontsize=8, title="Machine Risk")

    plt.tight_layout()
    plt.savefig(os.path.join(BASE, "phase4_schedule_chart.png"), dpi=150, bbox_inches="tight")
    plt.close()

# ── Console decision report ───────────────────────────────────────
print("\n── Top 10 Highest-Revenue Scheduled Jobs ───────────────────")
if not sched_df.empty:
    top10 = sched_df.nlargest(10, "Revenue")[
        ["Job_ID","Machine_ID","Risk_Tier","Start_Hour","End_Hour","Revenue","Allocation_Score"]]
    print(top10.to_string(index=False))

print("\n── Deferred Jobs (first 10) ────────────────────────────────")
if not deferred_df.empty:
    print(deferred_df.head(10).to_string(index=False))
else:
    print("  All jobs successfully scheduled!")

print("\nSaved: phase4_schedule.csv")
print("Saved: phase4_deferred_jobs.csv")
print("Saved: phase4_summary.csv")
print("Saved: phase4_weight_sensitivity.csv")
print("Saved: phase4_sensitivity_chart.png")
print("Saved: phase4_schedule_chart.png")
print("\nPhase 4 Complete!")
