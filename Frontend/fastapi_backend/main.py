"""
MECON IntelliOps — FastAPI Backend
Serves real Phase 1-4 CSV data to the React dashboard.
Run: uvicorn main:app --reload --port 8000
"""
import os, math
from pathlib import Path
from typing import Optional

import pandas as pd
import numpy as np
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MECON IntelliOps API", version="5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Paths ──────────────────────────────────────────────────────────
ROOT    = Path(__file__).parent.parent.parent   # ploting.py/
P1      = ROOT / "phase 1"
P2      = ROOT / "phase 2"
P3      = ROOT / "phase 3"
P4      = ROOT / "phase 4"

def safe_float(v):
    if v is None: return 0.0
    try:
        f = float(v)
        return 0.0 if (math.isnan(f) or math.isinf(f)) else f
    except: return 0.0

def clean_df(df: pd.DataFrame) -> pd.DataFrame:
    """Replace NaN/Inf with None for JSON serialisation."""
    return df.replace([np.inf, -np.inf], np.nan).where(pd.notnull(df), None)

# ── /api/health ────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "version": "5.0"}

# ── /api/machines ──────────────────────────────────────────────────
@app.get("/api/machines")
def machines():
    m  = pd.read_csv(P1 / "machines.csv")
    pr = pd.read_csv(P2 / "predictions.csv")
    cp = pd.read_csv(P1 / "cost_parameters.csv")

    df = m.merge(
            pr[["Machine_ID","Failure_Prob","Health_Score","Risk_Tier","Failure_Predicted"]],
            on="Machine_ID", how="left"
         ).merge(
            cp[["Machine_ID","Preventive_Maintenance_Cost","Corrective_Maintenance_Cost",
                "Downtime_Cost_Per_Hour","Maintenance_Duration_Hours"]],
            on="Machine_ID", how="left"
         )
    df = clean_df(df)
    return df.to_dict(orient="records")

# ── /api/jobs ──────────────────────────────────────────────────────
@app.get("/api/jobs")
def jobs():
    df = pd.read_csv(P1 / "jobs.csv")
    df = clean_df(df)
    return df.to_dict(orient="records")

# ── /api/predictions ───────────────────────────────────────────────
@app.get("/api/predictions")
def predictions():
    df = pd.read_csv(P2 / "predictions.csv")
    df = clean_df(df)
    return df.to_dict(orient="records")

# ── /api/phase3 ────────────────────────────────────────────────────
@app.get("/api/phase3")
def phase3(machine_id: Optional[str] = None):
    df = pd.read_csv(P3 / "phase3_machine_scenarios.csv")
    if machine_id:
        df = df[df["Machine_ID"] == machine_id]
    df = clean_df(df)
    return df.to_dict(orient="records")

@app.get("/api/phase3/summary")
def phase3_summary():
    df = pd.read_csv(P3 / "phase3_summary.csv")
    df = clean_df(df)
    return df.to_dict(orient="records")

# ── /api/phase4/schedule ───────────────────────────────────────────
@app.get("/api/phase4/schedule")
def phase4_schedule(
    w1: float = Query(0.5, ge=0, le=1),
    w2: float = Query(0.3, ge=0, le=1),
    w3: float = Query(0.2, ge=0, le=1),
):
    """
    Re-runs Phase 4 scheduling with given weights and returns results.
    Falls back to saved phase4_schedule.csv if weights match default.
    """
    # Normalise weights
    total = w1 + w2 + w3
    if total == 0: w1, w2, w3 = 0.5, 0.3, 0.2; total = 1.0
    w1, w2, w3 = w1/total, w2/total, w3/total

    machines  = pd.read_csv(P1 / "machines.csv")
    jobs_df   = pd.read_csv(P1 / "jobs.csv")
    costs_raw = pd.read_csv(P1 / "cost_parameters.csv")
    preds     = pd.read_csv(P2 / "predictions.csv")
    phase3_df = pd.read_csv(P3 / "phase3_machine_scenarios.csv")
    p3_pm     = phase3_df[phase3_df["Scenario_Name"] == "Preventive Now"].copy()

    mach = (machines
        .merge(preds[["Machine_ID","Failure_Prob","Health_Score","Risk_Tier"]], on="Machine_ID", how="left")
        .merge(costs_raw[["Machine_ID","Preventive_Maintenance_Cost","Corrective_Maintenance_Cost",
                           "Downtime_Cost_Per_Hour","Maintenance_Duration_Hours"]], on="Machine_ID", how="left")
        .merge(p3_pm[["Machine_ID","Maintenance_Start_Hour","Expected_Maintenance_Cost","Expected_Downtime_Hours"]],
               on="Machine_ID", how="left"))

    mach["R_m"] = mach["Failure_Prob"].fillna(0)
    cost_max    = mach["Expected_Maintenance_Cost"].max()
    mach["C_m"] = (mach["Expected_Maintenance_Cost"].fillna(0) / cost_max).clip(0, 1)
    mach["Total_Available_Hours"] = (mach["Daily_Operating_Hours"] * 7 - mach["Expected_Downtime_Hours"].fillna(0)).clip(0, None)
    mach["Maint_Start"] = mach["Maintenance_Start_Hour"].fillna(0)
    mach["Maint_End"]   = mach["Maint_Start"] + mach["Maintenance_Duration_Hours"].fillna(0)

    rev_max   = jobs_df["Revenue_Per_Job"].max()
    pri_max   = jobs_df["Priority_Level"].max()
    jobs_df["Rev_norm"] = jobs_df["Revenue_Per_Job"] / rev_max
    jobs_df["Pri_norm"] = 1 - (jobs_df["Priority_Level"] - 1) / (pri_max - 1 + 1e-9)
    jobs_df["T_j"]      = (jobs_df["Rev_norm"] * 0.6 + jobs_df["Pri_norm"] * 0.4).clip(0, 1)

    machine_used   = {mid: 0.0 for mid in mach["Machine_ID"]}
    machine_cursor = {}
    for mid in mach["Machine_ID"]:
        row = mach[mach["Machine_ID"] == mid].iloc[0]
        machine_cursor[mid] = float(row["Maint_End"]) if float(row["Maint_Start"]) == 0 else 0.0

    jobs_sorted = jobs_df.sort_values(["Priority_Level","Revenue_Per_Job"], ascending=[True, False]).reset_index(drop=True)
    schedule, deferred = [], []

    for _, job in jobs_sorted.iterrows():
        jid, jtype, jprocess = job["Job_ID"], job["Required_Machine_Type"], job["Processing_Time_Hours"]
        jdeadline, jrev, t_j = job["Deadline_Hours"], job["Revenue_Per_Job"], job["T_j"]

        candidates = mach[mach["Machine_Type"] == jtype]
        if candidates.empty:
            deferred.append({"Job_ID": jid, "Required_Machine_Type": jtype, "Priority_Level": int(job["Priority_Level"]), "Reason": f"No {jtype} exists in fleet"})
            continue

        scored = []
        for _, m in candidates.iterrows():
            mid   = m["Machine_ID"]
            r_m, c_m = float(m["R_m"]), float(m["C_m"])
            avail     = float(m["Total_Available_Hours"])
            used      = machine_used[mid]
            cursor    = machine_cursor[mid]
            score = w1 * float(t_j) - w2 * r_m - w3 * c_m

            if used + jprocess > avail: continue
            start_hour = cursor
            end_hour   = start_hour + jprocess
            if end_hour > jdeadline: continue

            m_start, m_end = float(m["Maint_Start"]), float(m["Maint_End"])
            if not (end_hour <= m_start or start_hour >= m_end):
                start_hour = m_end
                end_hour   = start_hour + jprocess
                if end_hour > jdeadline: continue

            scored.append({"Machine_ID": mid, "Machine_Type": str(m["Machine_Type"]),
                           "Risk_Tier": str(m["Risk_Tier"]), "Score": score,
                           "Start_Hour": start_hour, "End_Hour": end_hour, "R_m": r_m, "C_m": c_m})

        if not scored:
            cap_ok  = any(machine_used[m["Machine_ID"]] + jprocess <= m["Total_Available_Hours"] for _, m in candidates.iterrows())
            reason  = f"Deadline too tight" if jdeadline < jprocess else (f"All {jtype} machines over capacity" if not cap_ok else f"All {jtype} machines blocked by constraints")
            deferred.append({"Job_ID": jid, "Required_Machine_Type": jtype, "Priority_Level": int(job["Priority_Level"]), "Reason": reason})
            continue

        best = max(scored, key=lambda x: x["Score"])
        mid  = best["Machine_ID"]
        machine_used[mid]   += jprocess
        machine_cursor[mid]  = best["End_Hour"]

        schedule.append({
            "Job_ID": jid, "Machine_ID": mid, "Machine_Type": best["Machine_Type"],
            "Risk_Tier": best["Risk_Tier"],
            "Start_Hour": round(best["Start_Hour"], 2), "End_Hour": round(best["End_Hour"], 2),
            "Revenue": round(float(jrev), 2), "Priority_Level": int(job["Priority_Level"]),
            "Failure_Risk": round(best["R_m"], 3), "Score": round(best["Score"], 4),
        })

    metrics = {
        "jobs_scheduled"  : len(schedule),
        "jobs_deferred"   : len(deferred),
        "total_revenue"   : round(sum(j["Revenue"] for j in schedule), 2),
        "avg_risk"        : round(sum(j["Failure_Risk"] for j in schedule) / max(len(schedule), 1), 4),
        "w1": round(w1, 3), "w2": round(w2, 3), "w3": round(w3, 3),
    }
    return {"schedule": schedule, "deferred": deferred, "metrics": metrics}

# ── /api/phase4/sensitivity ────────────────────────────────────────
@app.get("/api/phase4/sensitivity")
def phase4_sensitivity():
    try:
        df = pd.read_csv(P4 / "phase4_weight_sensitivity.csv")
        df = clean_df(df)
        return df.to_dict(orient="records")
    except:
        return []

# ── /api/summary ───────────────────────────────────────────────────
@app.get("/api/summary")
def summary():
    try:
        preds = pd.read_csv(P2 / "predictions.csv")
        sched = pd.read_csv(P4 / "phase4_schedule.csv")
        p3sum = pd.read_csv(P3 / "phase3_summary.csv")

        pm_row   = p3sum[p3sum["Scenario_Name"] == "Preventive Now"].iloc[0]
        critical = int((preds["Risk_Tier"] == "Critical").sum())
        healthy  = int((preds["Risk_Tier"] == "Healthy").sum())

        return {
            "total_machines"     : len(preds),
            "critical_machines"  : critical,
            "healthy_machines"   : healthy,
            "jobs_scheduled"     : len(sched),
            "total_revenue"      : round(float(sched["Revenue"].sum()), 2),
            "total_downtime_pm"  : round(float(pm_row["Total_Expected_Downtime_Hours"]), 2),
            "total_maint_cost_pm": round(float(pm_row["Total_Expected_Maintenance_Cost"]), 2),
            "avg_failure_prob"   : round(float(preds["Failure_Prob"].mean()), 4),
        }
    except Exception as e:
        return {"error": str(e)}

# ── /api/shap ──────────────────────────────────────────────────────
@app.get("/api/shap")
def shap_values():
    try:
        df = pd.read_csv(P2 / "shap_values.csv")
        df = clean_df(df)
        # Return mean absolute SHAP per feature
        numeric = df.select_dtypes(include=[np.number])
        importance = numeric.abs().mean().sort_values(ascending=False).head(10)
        return [{"feature": k, "importance": round(float(v), 4)} for k, v in importance.items()]
    except Exception as e:
        return {"error": str(e)}
