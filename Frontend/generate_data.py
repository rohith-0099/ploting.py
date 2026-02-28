import pandas as pd
import numpy as np
import random
import os

# Set seed for reproducibility
np.random.seed(42)
random.seed(42)

def generate_machines(num_machines=15):
    """
    Generate machines.csv
    Fields: MachineID, TotalRunHours, VibrationLevel, TempLevel, LastMaintenanceDays, FailureLabel
    """
    machines = []
    
    for i in range(1, num_machines + 1):
        machine_id = f"M{i:03d}"
        
        # Assumption: Normal run hours around 20,000 hrs, std dev 5,000
        run_hours = round(np.random.normal(20000, 5000), 2)
        run_hours = max(1000, run_hours)
        
        # Risk factors
        vibration = round(np.random.uniform(0.5, 5.0), 2) # e.g. mm/s
        temp = round(np.random.uniform(60, 100), 2) # e.g. celsius
        last_maint = random.randint(10, 300) # days ago
        
        # Failure logic: Higher hours, vibration, temp -> higher risk of failure (approx 15-25% failure rate target)
        risk_score = (run_hours / 25000) * 0.3 + (vibration / 5.0) * 0.4 + (temp / 100) * 0.3
        
        # Threshold for failure based on assumption (15-25%)
        # Here we add some noise
        failure_prob = risk_score + np.random.normal(0, 0.1)
        failure_label = 1 if failure_prob > 0.75 else 0
        
        # Machine Type (e.g., CNC, Lathe, Mill)
        machine_type = random.choice(["CNC", "Lathe", "Milling"])
        
        # Capacity per hour (parts)
        capacity = random.randint(10, 50)
        
        machines.append({
            "MachineID": machine_id,
            "MachineType": machine_type,
            "TotalRunHours": run_hours,
            "VibrationLevel": vibration,
            "TempLevel": temp,
            "LastMaintenanceDays": last_maint,
            "CapacityPerHour": capacity,
            "FailureLabel": failure_label
        })
        
    df_machines = pd.DataFrame(machines)
    
    # Validation checks
    failure_rate = df_machines["FailureLabel"].mean()
    print(f"Generated {num_machines} machines. Failure rate: {failure_rate * 100:.2f}% (Target: 15-25%)")
    
    df_machines.to_csv("machines.csv", index=False)
    print("Saved machines.csv\n")
    return df_machines

def generate_jobs(num_jobs=60, machine_types=["CNC", "Lathe", "Milling"]):
    """
    Generate jobs.csv
    Fields: JobID, RequiredMachineType, ProcessingTimeHours, DeadlineHours, Priority, Revenue
    """
    jobs = []
    
    for i in range(1, num_jobs + 1):
        job_id = f"J{i:03d}"
        
        req_machine = random.choice(machine_types)
        
        # Uniform 4 to 24 hrs
        proc_time = round(np.random.uniform(4, 24), 2)
        
        # Deadline between proc_time + 5 to 72 hours
        deadline = round(proc_time + np.random.uniform(5, 48), 2)
        
        priority = random.choice(["Low", "Medium", "High", "Critical"])
        
        revenue = round(proc_time * random.uniform(50, 200), 2)
        
        jobs.append({
            "JobID": job_id,
            "RequiredMachineType": req_machine,
            "ProcessingTimeHours": proc_time,
            "DeadlineHours": deadline,
            "Priority": priority,
            "Revenue": revenue
        })
        
    df_jobs = pd.DataFrame(jobs)
    
    print(f"Generated {num_jobs} jobs.")
    print(df_jobs.describe(include='all'))
    
    df_jobs.to_csv("jobs.csv", index=False)
    print("\nSaved jobs.csv")
    return df_jobs

if __name__ == "__main__":
    print("--- MECON Phase 1: Data Generation ---\n")
    os.makedirs("data", exist_ok=True)
    os.chdir("data")
    
    df_m = generate_machines(20)
    df_j = generate_jobs(80, list(df_m["MachineType"].unique()))
    
    print("\nData Schema Summary:")
    print("Machines columns:", df_m.columns.tolist())
    print("Jobs columns:", df_j.columns.tolist())
