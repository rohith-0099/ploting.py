"""
MECON IntelliOps — FastAPI Backend v5.1
New in v5.1:
  - POST /api/jobs/add       — Operator submits a new revenue/priority job
  - POST /api/machines/add   — Management adds a new machine to the fleet
  - DELETE /api/jobs/{id}    — Remove a custom job
  - DELETE /api/machines/{id}— Remove a custom machine
  - GET  /api/fleet/status   — Fleet capacity by machine type
  - POST /api/jobs/find-best — Revenue/Priority-oriented best machine finder
  - GET  /api/session/jobs   — Get all custom-submitted jobs
  - GET  /api/session/machines — Get custom machines
Run: uvicorn main:app --reload --port 8000
"""
import os, math
from pathlib import Path
from typing import Optional, List

import pandas as pd
import numpy as np
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="MECON IntelliOps API", version="5.1")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

ROOT = Path(__file__).parent.parent.parent
P1, P2, P3, P4 = ROOT/"phase 1", ROOT/"phase 2", ROOT/"phase 3", ROOT/"phase 4"

# ── CSV persistence paths ─────────────────────────────────────────
CUSTOM_JOBS_CSV     = P1 / "custom_jobs.csv"
CUSTOM_MACHINES_CSV = P1 / "custom_machines.csv"

# ── In-memory session state ────────────────────────────────────────
_session_jobs: list     = []
_session_machines: list = []
_job_counter            = [0]
_machine_counter        = [0]

def _persist_jobs():
    """Write current custom jobs list to CSV."""
    if _session_jobs:
        pd.DataFrame(_session_jobs).to_csv(CUSTOM_JOBS_CSV, index=False)
    else:
        if CUSTOM_JOBS_CSV.exists(): CUSTOM_JOBS_CSV.unlink()

def _persist_machines():
    """Write current custom machines list to CSV."""
    if _session_machines:
        pd.DataFrame(_session_machines).to_csv(CUSTOM_MACHINES_CSV, index=False)
    else:
        if CUSTOM_MACHINES_CSV.exists(): CUSTOM_MACHINES_CSV.unlink()

@app.on_event("startup")
def _load_persisted_data():
    """On server start, reload custom jobs and machines from CSV if they exist."""
    global _session_jobs, _session_machines, _job_counter, _machine_counter
    # Load custom jobs
    if CUSTOM_JOBS_CSV.exists():
        try:
            df = pd.read_csv(CUSTOM_JOBS_CSV)
            _session_jobs = df.to_dict(orient="records")
            # Set counter to max existing id
            ids = [j["Job_ID"] for j in _session_jobs if str(j.get("Job_ID","")).startswith("CUST-")]
            nums = [int(i.split("-")[1]) for i in ids if i.split("-")[1].isdigit()]
            _job_counter[0] = max(nums, default=0)
            print(f"[startup] Loaded {len(_session_jobs)} custom jobs from {CUSTOM_JOBS_CSV}")
        except Exception as e:
            print(f"[startup] Failed to load custom jobs: {e}")
    # Load custom machines
    if CUSTOM_MACHINES_CSV.exists():
        try:
            df = pd.read_csv(CUSTOM_MACHINES_CSV)
            _session_machines = df.to_dict(orient="records")
            ids  = [m["Machine_ID"] for m in _session_machines if str(m.get("Machine_ID","")).startswith("MCH-NEW-")]
            nums = [int(i.split("-")[2]) for i in ids if len(i.split("-"))>2 and i.split("-")[2].isdigit()]
            _machine_counter[0] = max(nums, default=0)
            print(f"[startup] Loaded {len(_session_machines)} custom machines from {CUSTOM_MACHINES_CSV}")
        except Exception as e:
            print(f"[startup] Failed to load custom machines: {e}")

# ── Pydantic Models ────────────────────────────────────────────────
class JobCreate(BaseModel):
    Required_Machine_Type: str
    Processing_Time_Hours: float = Field(..., gt=0, le=168)
    Load_Requirement: float      = Field(50.0, ge=0, le=100)
    Priority_Level: int          = Field(3, ge=1, le=5)
    Deadline_Hours: float        = Field(168.0, gt=0, le=168)
    Revenue_Per_Job: float       = Field(..., gt=0)
    Notes: str                   = ""

class MachineCreate(BaseModel):
    Machine_Type: str
    Machine_Age: float              = Field(5.0, ge=0)
    Daily_Operating_Hours: float    = Field(12.0, gt=0, le=24)
    Avg_Load_Percentage: float      = Field(60.0, ge=0, le=100)
    Avg_Vibration: float            = Field(3.0, ge=0)
    Avg_Temperature: float          = Field(75.0, ge=0)
    Total_Run_Hours: float          = Field(5000.0, ge=0)
    Last_Maintenance_Days: float    = Field(30.0, ge=0)
    Failure_History_Count: int      = Field(0, ge=0)
    Energy_Consumption_Rate: float  = Field(50.0, ge=0)

class AllocateRequest(BaseModel):
    job_id: str
    machine_id: str

# ── Helpers ────────────────────────────────────────────────────────
def safe_float(v):
    if v is None: return 0.0
    try:
        f = float(v)
        return 0.0 if (math.isnan(f) or math.isinf(f)) else f
    except: return 0.0

def clean_df(df: pd.DataFrame) -> pd.DataFrame:
    # Replace inf with nan, then fill all nan with None (JSON null)
    return df.replace([np.inf, -np.inf], np.nan).fillna(np.nan).replace({np.nan: None})

def _load_master_machines():
    """Load base machines + session machines merged."""
    m  = pd.read_csv(P1/"machines.csv")
    pr = pd.read_csv(P2/"predictions.csv")
    cp = pd.read_csv(P1/"cost_parameters.csv")
    df = (m.merge(pr[["Machine_ID","Failure_Prob","Health_Score","Risk_Tier","Failure_Predicted"]],
                  on="Machine_ID", how="left")
           .merge(cp[["Machine_ID","Preventive_Maintenance_Cost","Corrective_Maintenance_Cost",
                       "Downtime_Cost_Per_Hour","Maintenance_Duration_Hours"]],
                  on="Machine_ID", how="left"))

    if _session_machines:
        extra = []
        for m2 in _session_machines:
            extra.append({
                "Machine_ID": m2["Machine_ID"], "Machine_Type": m2["Machine_Type"],
                "Machine_Age": m2["Machine_Age"], "Total_Run_Hours": m2["Total_Run_Hours"],
                "Avg_Load_Percentage": m2["Avg_Load_Percentage"],
                "Avg_Temperature": m2["Avg_Temperature"], "Avg_Vibration": m2["Avg_Vibration"],
                "Energy_Consumption_Rate": m2["Energy_Consumption_Rate"],
                "Last_Maintenance_Days": m2["Last_Maintenance_Days"],
                "Failure_History_Count": m2["Failure_History_Count"],
                "Daily_Operating_Hours": m2["Daily_Operating_Hours"],
                "Failure_Prob": 0.02, "Health_Score": 95.0,
                "Risk_Tier": "Healthy", "Failure_Predicted": 0,
                "Preventive_Maintenance_Cost": 15000, "Corrective_Maintenance_Cost": 60000,
                "Downtime_Cost_Per_Hour": 5000, "Maintenance_Duration_Hours": 4,
                "is_custom": True
            })
        df = pd.concat([df, pd.DataFrame(extra)], ignore_index=True)
    return df

def _run_schedule(w1, w2, w3):
    """Full scheduler with session jobs and machines merged in."""
    jobs_df   = pd.read_csv(P1/"jobs.csv")
    costs_raw = pd.read_csv(P1/"cost_parameters.csv")
    phase3_df = pd.read_csv(P3/"phase3_machine_scenarios.csv")
    p3_pm     = phase3_df[phase3_df["Scenario_Name"] == "Preventive Now"].copy()
    mach_base = _load_master_machines()

    mach = mach_base.merge(
        p3_pm[["Machine_ID","Maintenance_Start_Hour","Expected_Maintenance_Cost","Expected_Downtime_Hours"]],
        on="Machine_ID", how="left")

    mach["R_m"] = mach["Failure_Prob"].fillna(0)
    cost_max    = mach.get("Expected_Maintenance_Cost", pd.Series([1])).max() or 1
    mach["C_m"] = (mach["Expected_Maintenance_Cost"].fillna(0) / cost_max).clip(0, 1)
    mach["Total_Available_Hours"] = (mach["Daily_Operating_Hours"] * 7 -
                                     mach["Expected_Downtime_Hours"].fillna(0)).clip(0, None)
    mach["Maint_Start"] = mach["Maintenance_Start_Hour"].fillna(0)
    mach["Maint_End"]   = mach["Maint_Start"] + mach["Maintenance_Duration_Hours"].fillna(0)

    # Merge session jobs with base jobs
    if _session_jobs:
        sj = pd.DataFrame(_session_jobs)
        sj["Load_Requirement"] = sj.get("Load_Requirement", 50.0)
        jobs_df = pd.concat([jobs_df, sj[jobs_df.columns.intersection(sj.columns)]], ignore_index=True)
        # Fill missing columns for session jobs
        for col in ["Revenue_Per_Job","Priority_Level","Processing_Time_Hours","Deadline_Hours","Required_Machine_Type"]:
            if col not in jobs_df.columns:
                jobs_df[col] = sj[col]

    rev_max = jobs_df["Revenue_Per_Job"].max()
    pri_max = jobs_df["Priority_Level"].max()
    jobs_df["Rev_norm"] = jobs_df["Revenue_Per_Job"] / rev_max
    jobs_df["Pri_norm"] = 1 - (jobs_df["Priority_Level"] - 1) / (pri_max - 1 + 1e-9)
    jobs_df["T_j"]      = (jobs_df["Rev_norm"] * 0.6 + jobs_df["Pri_norm"] * 0.4).clip(0, 1)

    total = w1 + w2 + w3 or 1
    w1, w2, w3 = w1/total, w2/total, w3/total

    machine_used   = {mid: 0.0 for mid in mach["Machine_ID"]}
    machine_cursor = {}
    for mid in mach["Machine_ID"]:
        row = mach[mach["Machine_ID"] == mid].iloc[0]
        machine_cursor[mid] = float(row["Maint_End"]) if float(row["Maint_Start"]) == 0 else 0.0

    jobs_sorted = jobs_df.sort_values(["Priority_Level","Revenue_Per_Job"],
                                      ascending=[True, False]).reset_index(drop=True)
    schedule, deferred = [], []

    for _, job in jobs_sorted.iterrows():
        jid       = job["Job_ID"]
        jtype     = str(job["Required_Machine_Type"])
        jprocess  = float(job["Processing_Time_Hours"])
        jdeadline = float(job["Deadline_Hours"])
        jrev      = float(job.get("Revenue_Per_Job", 0))
        t_j       = float(job.get("T_j", 0.5))

        candidates = mach[mach["Machine_Type"] == jtype]
        if candidates.empty:
            deferred.append({"Job_ID": jid, "Required_Machine_Type": jtype,
                             "Priority_Level": int(job["Priority_Level"]), "Reason": f"No {jtype} available"})
            continue

        scored = []
        for _, m in candidates.iterrows():
            mid   = m["Machine_ID"]
            r_m, c_m = float(m["R_m"]), float(m["C_m"])
            avail    = float(m["Total_Available_Hours"])
            cursor   = machine_cursor[mid]
            score    = w1 * t_j - w2 * r_m - w3 * c_m
            if machine_used[mid] + jprocess > avail: continue
            start_hour = cursor; end_hour = start_hour + jprocess
            if end_hour > jdeadline: continue
            m_start, m_end = float(m["Maint_Start"]), float(m["Maint_End"])
            if not (end_hour <= m_start or start_hour >= m_end):
                start_hour = m_end; end_hour = start_hour + jprocess
                if end_hour > jdeadline: continue
            scored.append({"Machine_ID": mid, "Machine_Type": jtype, "Risk_Tier": str(m["Risk_Tier"]),
                           "Score": score, "Start_Hour": start_hour, "End_Hour": end_hour,
                           "R_m": r_m, "C_m": c_m})

        if not scored:
            deferred.append({"Job_ID": jid, "Required_Machine_Type": jtype,
                             "Priority_Level": int(job["Priority_Level"]),
                             "Reason": "Deadline/capacity/maintenance constraint"})
            continue

        best = max(scored, key=lambda x: x["Score"])
        mid  = best["Machine_ID"]
        machine_used[mid] += jprocess
        machine_cursor[mid] = best["End_Hour"]
        schedule.append({
            "Job_ID": jid, "Machine_ID": mid, "Machine_Type": best["Machine_Type"],
            "Risk_Tier": best["Risk_Tier"],
            "Start_Hour": round(best["Start_Hour"], 2), "End_Hour": round(best["End_Hour"], 2),
            "Revenue": round(jrev, 2), "Priority_Level": int(job["Priority_Level"]),
            "Failure_Risk": round(best["R_m"], 3), "Score": round(best["Score"], 4),
            "is_custom": bool(job.get("is_custom", False)),
        })

    metrics = {
        "jobs_scheduled": len(schedule), "jobs_deferred": len(deferred),
        "total_revenue": round(sum(j["Revenue"] for j in schedule), 2),
        "avg_risk": round(sum(j["Failure_Risk"] for j in schedule) / max(len(schedule), 1), 4),
        "w1": round(w1, 3), "w2": round(w2, 3), "w3": round(w3, 3),
        "custom_jobs_scheduled": sum(1 for j in schedule if j.get("is_custom")),
        "custom_machines_in_fleet": len(_session_machines),
    }
    return schedule, deferred, metrics

# ══════════════════════════════════════════════════════════════════
# EXISTING ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.get("/api/health")
def health(): return {"status": "ok", "version": "5.1"}

@app.get("/api/machines")
def machines():
    df = _load_master_machines()
    return clean_df(df).to_dict(orient="records")

@app.get("/api/jobs")
def jobs():
    df = pd.read_csv(P1/"jobs.csv")
    if _session_jobs:
        extra = pd.DataFrame(_session_jobs)
        df = pd.concat([df, extra], ignore_index=True)
    return clean_df(df).to_dict(orient="records")

@app.get("/api/predictions")
def predictions():
    df = pd.read_csv(P2/"predictions.csv")
    return clean_df(df).to_dict(orient="records")

@app.get("/api/phase3")
def phase3(machine_id: Optional[str] = None):
    df = pd.read_csv(P3/"phase3_machine_scenarios.csv")
    if machine_id: df = df[df["Machine_ID"] == machine_id]
    return clean_df(df).to_dict(orient="records")

@app.get("/api/phase3/summary")
def phase3_summary():
    return clean_df(pd.read_csv(P3/"phase3_summary.csv")).to_dict(orient="records")

@app.get("/api/phase4/schedule")
def phase4_schedule(w1: float = 0.5, w2: float = 0.3, w3: float = 0.2):
    s, d, m = _run_schedule(w1, w2, w3)
    return {"schedule": s, "deferred": d, "metrics": m}

@app.get("/api/phase4/sensitivity")
def phase4_sensitivity():
    try: return clean_df(pd.read_csv(P4/"phase4_weight_sensitivity.csv")).to_dict(orient="records")
    except: return []

@app.get("/api/summary")
def summary():
    try:
        preds = pd.read_csv(P2/"predictions.csv")
        sched = pd.read_csv(P4/"phase4_schedule.csv")
        p3sum = pd.read_csv(P3/"phase3_summary.csv")
        pm_row = p3sum[p3sum["Scenario_Name"] == "Preventive Now"].iloc[0]
        return {
            "total_machines": len(preds) + len(_session_machines),
            "critical_machines": int((preds["Risk_Tier"] == "Critical").sum()),
            "healthy_machines": int((preds["Risk_Tier"] == "Healthy").sum()),
            "jobs_scheduled": len(sched) + len(_session_jobs),
            "total_revenue": round(float(sched["Revenue"].sum()), 2),
            "total_downtime_pm": round(float(pm_row["Total_Expected_Downtime_Hours"]), 2),
            "total_maint_cost_pm": round(float(pm_row["Total_Expected_Maintenance_Cost"]), 2),
            "avg_failure_prob": round(float(preds["Failure_Prob"].mean()), 4),
        }
    except Exception as e: return {"error": str(e)}

@app.get("/api/shap")
def shap_values():
    try:
        df = pd.read_csv(P2/"shap_values.csv")
        importance = df.select_dtypes(include=[np.number]).abs().mean().sort_values(ascending=False).head(10)
        return [{"feature": k, "importance": round(float(v), 4)} for k, v in importance.items()]
    except Exception as e: return [{"error": str(e)}]

# ══════════════════════════════════════════════════════════════════
# NEW: OPERATOR INTERFACE ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.post("/api/jobs/add")
def add_job(job: JobCreate):
    """Operator submits a new Revenue/Priority-oriented job. Also persists to custom_jobs.csv."""
    _job_counter[0] += 1
    job_id = f"CUST-{_job_counter[0]:03d}"
    new_job = {
        "Job_ID": job_id, "is_custom": True,
        **job.dict()
    }
    _session_jobs.append(new_job)
    _persist_jobs()   # ← write to CSV immediately
    return {"success": True, "job_id": job_id,
            "message": f"Job {job_id} submitted to queue and saved to custom_jobs.csv.",
            "csv_path": str(CUSTOM_JOBS_CSV), "data": new_job}

@app.delete("/api/jobs/{job_id}")
def delete_job(job_id: str):
    global _session_jobs
    before = len(_session_jobs)
    _session_jobs = [j for j in _session_jobs if j["Job_ID"] != job_id]
    if len(_session_jobs) == before:
        raise HTTPException(404, f"Custom job {job_id} not found — cannot delete base jobs")
    _persist_jobs()   # ← update CSV
    return {"success": True, "message": f"Job {job_id} removed from queue and CSV updated."}

@app.get("/api/session/jobs")
def get_session_jobs(): return _session_jobs

@app.post("/api/jobs/find-best")
def find_best_machine(job: JobCreate, w1: float = 0.5, w2: float = 0.3, w3: float = 0.2):
    """
    Revenue/Priority-oriented: Given a job spec, rank all candidate machines
    and return ranked list with predicted risk, cost, and allocation score.
    """
    mach_df = _load_master_machines()
    phase3_df = pd.read_csv(P3/"phase3_machine_scenarios.csv")
    p3_pm = phase3_df[phase3_df["Scenario_Name"] == "Preventive Now"].copy()

    mach = mach_df.merge(
        p3_pm[["Machine_ID","Maintenance_Start_Hour","Expected_Maintenance_Cost","Expected_Downtime_Hours"]],
        on="Machine_ID", how="left")

    mach["R_m"] = mach["Failure_Prob"].fillna(0)
    cost_max    = mach["Expected_Maintenance_Cost"].fillna(0).max() or 1
    mach["C_m"] = (mach["Expected_Maintenance_Cost"].fillna(0) / cost_max).clip(0, 1)
    mach["Total_Available_Hours"] = (mach["Daily_Operating_Hours"] * 7 -
                                     mach["Expected_Downtime_Hours"].fillna(0)).clip(0, None)
    mach["Maint_Start"] = mach["Maintenance_Start_Hour"].fillna(0)
    mach["Maint_End"]   = mach["Maint_Start"] + mach["Maintenance_Duration_Hours"].fillna(0)

    candidates = mach[mach["Machine_Type"] == job.Required_Machine_Type]

    # Compute T(j) for this job
    base_jobs = pd.read_csv(P1/"jobs.csv")
    rev_max    = max(base_jobs["Revenue_Per_Job"].max(), job.Revenue_Per_Job)
    pri_max    = 5
    rev_norm   = job.Revenue_Per_Job / rev_max
    pri_norm   = 1 - (job.Priority_Level - 1) / (pri_max - 1 + 1e-9)
    t_j        = (rev_norm * 0.6 + pri_norm * 0.4)

    total = w1 + w2 + w3 or 1
    w1, w2, w3 = w1/total, w2/total, w3/total

    results = []
    for _, m in candidates.iterrows():
        mid       = m["Machine_ID"]
        r_m, c_m  = float(m["R_m"]), float(m["C_m"])
        avail     = float(m["Total_Available_Hours"])
        m_end     = float(m["Maint_End"])
        score     = w1 * t_j - w2 * r_m - w3 * c_m
        if avail < job.Processing_Time_Hours: continue
        start     = m_end
        end       = start + job.Processing_Time_Hours
        if end > job.Deadline_Hours:
            start = 0; end = job.Processing_Time_Hours
        if end > job.Deadline_Hours: continue
        results.append({
            "Machine_ID":    mid,
            "Machine_Type":  str(m["Machine_Type"]),
            "Risk_Tier":     str(m["Risk_Tier"]),
            "Health_Score":  round(float(m.get("Health_Score", 0)), 1),
            "Failure_Risk":  round(r_m * 100, 1),
            "Cost_Norm":     round(c_m, 3),
            "Allocation_Score": round(score, 4),
            "Earliest_Start": round(start, 1),
            "Earliest_End":   round(end, 1),
            "Available_Hours": round(avail, 1),
        })

    results.sort(key=lambda x: x["Allocation_Score"], reverse=True)
    return {
        "job_spec": job.dict(),
        "t_j": round(t_j, 4),
        "total_candidates": len(candidates),
        "valid_machines": len(results),
        "ranked_machines": results[:10],
        "best_machine": results[0] if results else None,
        "recommendation": (
            f"Assign to {results[0]['Machine_ID']} — Score {results[0]['Allocation_Score']:.4f}, "
            f"Risk {results[0]['Failure_Risk']:.1f}%, Start Hour {results[0]['Earliest_Start']}"
        ) if results else "No valid machine found for this job specification.",
    }

# ══════════════════════════════════════════════════════════════════
# NEW: MANAGEMENT DASHBOARD ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.post("/api/machines/add")
def add_machine(machine: MachineCreate):
    """Management adds a new machine to the fleet. Also persists to custom_machines.csv."""
    _machine_counter[0] += 1
    machine_id = f"MCH-NEW-{_machine_counter[0]:03d}"
    age_factor  = min(machine.Machine_Age / 20, 1.0)
    vib_factor  = min(machine.Avg_Vibration / 10, 1.0)
    hist_factor = min(machine.Failure_History_Count / 5, 1.0)
    fp = round((age_factor * 0.4 + vib_factor * 0.4 + hist_factor * 0.2) * 0.3, 4)
    risk_tier = "Critical" if fp > 0.5 else "High Risk" if fp > 0.3 else "At Risk" if fp > 0.15 else "Healthy"

    new_machine = {
        "Machine_ID": machine_id, "is_custom": True,
        "Failure_Prob": fp, "Health_Score": round(max(0, 95 - fp * 200), 1),
        "Risk_Tier": risk_tier,
        **machine.dict()
    }
    _session_machines.append(new_machine)
    _persist_machines()   # ← write to CSV immediately
    return {"success": True, "machine_id": machine_id,
            "message": f"Machine {machine_id} added to fleet and saved to custom_machines.csv.",
            "csv_path": str(CUSTOM_MACHINES_CSV),
            "estimated_failure_prob": fp, "risk_tier": risk_tier, "data": new_machine}

@app.delete("/api/machines/{machine_id}")
def delete_machine(machine_id: str):
    global _session_machines
    before = len(_session_machines)
    _session_machines = [m for m in _session_machines if m["Machine_ID"] != machine_id]
    if len(_session_machines) == before:
        raise HTTPException(404, f"Custom machine {machine_id} not found")
    _persist_machines()   # ← update CSV
    return {"success": True, "message": f"Machine {machine_id} removed from fleet and CSV updated."}

@app.get("/api/session/machines")
def get_session_machines(): return _session_machines

@app.get("/api/fleet/status")
def fleet_status():
    """Returns fleet capacity, utilization, and health breakdown by machine type."""
    mach_df   = _load_master_machines()
    jobs_df   = pd.read_csv(P1/"jobs.csv")
    if _session_jobs:
        extra = pd.DataFrame(_session_jobs)
        jobs_df = pd.concat([jobs_df, extra[jobs_df.columns.intersection(extra.columns)]], ignore_index=True)

    # Try to load the existing schedule for utilization
    try:
        sched = pd.read_csv(P4/"phase4_schedule.csv")
    except:
        sched = pd.DataFrame()

    result = []
    for mtype, group in mach_df.groupby("Machine_Type"):
        total      = len(group)
        healthy    = len(group[group["Risk_Tier"].isin(["Healthy","Monitor"])])
        critical   = len(group[group["Risk_Tier"] == "Critical"])
        custom_cnt = int(group["is_custom"].sum()) if "is_custom" in group.columns else 0
        total_avail_h = (group["Daily_Operating_Hours"] * 7).sum()
        jobs_of_type  = len(jobs_df[jobs_df["Required_Machine_Type"] == mtype])

        if not sched.empty:
            sched_type  = sched[sched["Machine_Type"] == mtype]
            used_h      = (sched_type["End_Hour"] - sched_type["Start_Hour"]).sum()
        else:
            used_h = 0

        utilization = round(min(used_h / max(total_avail_h, 1) * 100, 100), 1)
        result.append({
            "Machine_Type":       mtype,
            "Total_Machines":     total,
            "Healthy_Machines":   healthy,
            "Critical_Machines":  critical,
            "Custom_Added":       custom_cnt,
            "Total_Available_Hours": round(total_avail_h, 0),
            "Used_Hours":         round(used_h, 1),
            "Utilization_Pct":    utilization,
            "Total_Jobs_Needed":  jobs_of_type,
        })

    return sorted(result, key=lambda x: x["Utilization_Pct"], reverse=True)

@app.post("/api/jobs/allocate")
def manual_allocate(req: AllocateRequest):
    """Manual override: Force a custom job onto a specific machine."""
    mach_df = _load_master_machines()
    machine = mach_df[mach_df["Machine_ID"] == req.machine_id]
    if machine.empty:
        raise HTTPException(404, f"Machine {req.machine_id} not found")

    job = next((j for j in _session_jobs if j["Job_ID"] == req.job_id), None)
    if not job:
        raise HTTPException(404, f"Custom job {req.job_id} not found")

    m        = machine.iloc[0]
    start    = float(m.get("Maint_End") or 0)
    end      = start + float(job["Processing_Time_Hours"])
    fp       = float(m.get("Failure_Prob") or 0)
    risk_colour = "🔴 Critical" if fp > 0.7 else "🟠 High" if fp > 0.4 else "🟡 At Risk" if fp > 0.2 else "🟢 Safe"

    return {
        "success": True,
        "allocation": {
            "Job_ID": req.job_id, "Machine_ID": req.machine_id,
            "Machine_Type": str(m["Machine_Type"]),
            "Start_Hour": round(start, 1), "End_Hour": round(end, 1),
            "Revenue": job["Revenue_Per_Job"], "Priority": job["Priority_Level"],
            "Machine_Failure_Risk": f"{fp*100:.1f}%",
            "Risk_Assessment": risk_colour,
        },
        "warning": "Machine failure risk is above 40%. Consider a healthier machine." if fp > 0.4 else None
    }

@app.delete("/api/session/clear")
def clear_session():
    global _session_jobs, _session_machines
    _session_jobs, _session_machines = [], []
    _job_counter[0] = 0; _machine_counter[0] = 0
    _persist_jobs()       # ← removes CSV (empty list → deletes file)
    _persist_machines()   # ← removes CSV
    return {"success": True, "message": "Session cleared. CSV files removed."}
