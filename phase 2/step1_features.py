import os
import pandas as pd
import numpy as np

BASE   = os.path.dirname(os.path.abspath(__file__))
PHASE1 = os.path.join(BASE, "..", "phase 1")

df = pd.read_csv(os.path.join(PHASE1, "machines.csv"))

df["Risk_Score"]          = df["Avg_Vibration"] * 0.4 + (df["Machine_Age"] / 17) * 0.35 + (df["Last_Maintenance_Days"] / 365) * 0.25
df["Thermal_Stress"]      = df["Avg_Temperature"] * df["Avg_Load_Percentage"] / 100
df["Maintenance_Overdue"] = (df["Last_Maintenance_Days"] > 180).astype(int)
df["Wear_Index"]          = df["Total_Run_Hours"] / (df["Machine_Age"] + 1)
df["Failure_Density"]     = df["Failure_History_Count"] / (df["Machine_Age"] + 1)

df.to_csv(os.path.join(BASE, "machines_featured.csv"), index=False)
print(f"Step 1 done — machines_featured.csv: {df.shape}")
