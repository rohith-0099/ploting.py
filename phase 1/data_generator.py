import pandas as pd
import numpy as np
import random

np.random.seed(42)
random.seed(42)

# ── HELPER ──────────────────────────────────────────────────────
def sigmoid(x):
    return 1 / (1 + np.exp(-x))

machine_types = ["Lathe", "CNC Mill", "Hydraulic Press", "Welding Unit", "Conveyor"]

# ── MACHINE DATASET ─────────────────────────────────────────────
machines = []

for i in range(1, 16):

    # ── RULE 1: Age must match Installation Year ─────────────────
    installation_year = random.randint(2008, 2022)
    machine_age = 2025 - installation_year   # derived, NEVER random

    # ── RULE 2: Run hours must scale with age ────────────────────
    daily_operating_hours = round(random.uniform(6, 20), 1)
    total_run_hours = round(machine_age * 365 * (daily_operating_hours / 24) * random.uniform(0.7, 0.95), 1)

    # ── RULE 3: Temperature correlates with Load ─────────────────
    avg_load = round(random.uniform(40, 95), 2)
    avg_temperature = round(np.random.normal(loc=50 + avg_load * 0.3, scale=5), 2)
    # 40% load → ~62°C | 90% load → ~77°C

    # Other sensor fields
    avg_vibration = round(np.random.lognormal(mean=1.5, sigma=0.4), 2)
    energy_consumption_rate = round(random.uniform(5, 30), 2)
    capacity_per_hour = round(random.uniform(10, 80), 1)
    last_maintenance_days = random.randint(5, 365)

    # After defining machine_age, cap failure history realistically
    # Age 3 → max 1 failure | Age 15 → max 5 failures | Age 17 → max 5 failures
    failure_history_count = random.randint(0, max(1, machine_age // 3))

    # ── RULE 5: Downtime scales with failure history ──────────────
    downtime_last_year = round(
        failure_history_count * random.uniform(8, 25) + random.uniform(0, 10), 1
    )

    # ── RULE 6: Maintenance cost scales with downtime + failures ──
    maintenance_cost_last_year = round(
        failure_history_count * random.uniform(5000, 15000) +
        downtime_last_year * random.uniform(200, 500), 2
    )

    # ── RULE 4: Failure Label caused by bad sensor values ─────────
    age_norm  = machine_age / 17                        # 0 to 1
    vib_norm  = min(avg_vibration / 15, 1)              # 0 to 1
    maint_norm = min(last_maintenance_days / 365, 1)    # 0 to 1

    failure_prob = sigmoid(
        3.5 * age_norm +    # older = riskier
        4.0 * vib_norm +    # high vibration = riskier
        2.5 * maint_norm -  # long since maintenance = riskier
        4.0                 # bias to keep ~25-30% failure rate
    )

    failure_label = int(np.random.binomial(1, failure_prob))

    # RUL: healthy machines have more life left
    remaining_useful_life = round(max(0, (1 - failure_prob) * total_run_hours * 0.15), 1)

    machines.append({
        "Machine_ID"                  : f"MCH-{i:03d}",
        "Machine_Type"                : random.choice(machine_types),
        "Installation_Year"           : installation_year,
        "Machine_Age"                 : machine_age,           # Rule 1
        "Total_Run_Hours"             : total_run_hours,       # Rule 2
        "Avg_Load_Percentage"         : avg_load,
        "Daily_Operating_Hours"       : daily_operating_hours, # Rule 2
        "Capacity_Per_Hour"           : capacity_per_hour,
        "Avg_Temperature"             : avg_temperature,       # Rule 3
        "Avg_Vibration"               : avg_vibration,
        "Energy_Consumption_Rate"     : energy_consumption_rate,
        "Last_Maintenance_Days"       : last_maintenance_days,
        "Failure_History_Count"       : failure_history_count,
        "Downtime_Hours_Last_Year"    : downtime_last_year,    # Rule 5
        "Maintenance_Cost_Last_Year"  : maintenance_cost_last_year,  # Rule 6
        "Failure_Label"               : failure_label,         # Rule 4
        "Remaining_Useful_Life_Hours" : remaining_useful_life
    })

machines_df = pd.DataFrame(machines)
machines_df.to_csv("machines.csv", index=False)
print("✅ machines.csv →", machines_df.shape)
print(machines_df[["Machine_ID","Machine_Age","Avg_Vibration","Last_Maintenance_Days",
                    "Failure_Label","Failure_History_Count","Downtime_Hours_Last_Year"]].to_string())


# ── JOB DATASET ─────────────────────────────────────────────────
jobs = []

for i in range(1, 56):
    priority = random.randint(1, 5)
    processing_time = round(random.uniform(1, 24), 1)

    # Deadline must be logical: higher priority = tighter deadline
    # Priority 5 (urgent) → deadline 10–50 hrs
    # Priority 1 (low)    → deadline 80–168 hrs
    base_deadline = 168 - (priority * 25)
    deadline = round(random.uniform(base_deadline - 10, base_deadline + 20), 1)
    deadline = max(processing_time + 2, deadline)  # deadline > processing time always

    # Revenue scales with priority and processing time
    revenue = round(priority * processing_time * random.uniform(50, 150), 2)

    jobs.append({
        "Job_ID"                      : f"JOB-{i:03d}",
        "Required_Machine_Type"       : random.choice(machine_types),
        "Processing_Time_Hours"       : processing_time,
        "Load_Requirement_Percentage" : round(random.uniform(20, 100), 1),
        "Priority_Level"              : priority,
        "Deadline_Hours"              : deadline,
        "Revenue_Per_Job"             : revenue
    })

jobs_df = pd.DataFrame(jobs)
jobs_df.to_csv("jobs.csv", index=False)
print("\n✅ jobs.csv →", jobs_df.shape)


# ── COST PARAMETERS ─────────────────────────────────────────────
cost_params = []

for _, row in machines_df.iterrows():
    cost_params.append({
        "Machine_ID"                   : row["Machine_ID"],
        "Machine_Type"                 : row["Machine_Type"],
        "Preventive_Maintenance_Cost"  : round(random.uniform(8000, 25000), 2),
        "Corrective_Maintenance_Cost"  : round(random.uniform(30000, 90000), 2),
        "Downtime_Cost_Per_Hour"       : round(random.uniform(500, 3000), 2),
        "Replacement_Cost"             : round(random.uniform(100000, 500000), 2),
        "Maintenance_Duration_Hours"   : round(random.uniform(4, 48), 1)
    })

cost_df = pd.DataFrame(cost_params)
cost_df.to_csv("cost_parameters.csv", index=False)
print("\n✅ cost_parameters.csv →", cost_df.shape)

print("\n🎯 All 3 datasets generated successfully!")
