import pandas as pd
import matplotlib.pyplot as plt
import numpy as np

machines = pd.read_csv("machines.csv")

fig, axes = plt.subplots(2, 2, figsize=(12, 8))
fig.suptitle("Machine Data Distribution Analysis", fontsize=14)

# Plot 1 - Vibration (should be right-skewed / log-normal)
axes[0,0].hist(machines["Avg_Vibration"], bins=10, color="steelblue", edgecolor="black")
axes[0,0].set_title("Avg Vibration (Log-Normal Expected)")
axes[0,0].set_xlabel("Vibration (mm/s)")

# Plot 2 - Failure Label distribution (should NOT be 50/50)
axes[0,1].bar(["Healthy (0)", "Failed (1)"],
              machines["Failure_Label"].value_counts().sort_index(),
              color=["green", "red"])
axes[0,1].set_title("Failure Label Distribution")

# Plot 3 - Temperature vs Load (should show positive correlation)
axes[1,0].scatter(machines["Avg_Load_Percentage"], machines["Avg_Temperature"],
                  color="orange")
axes[1,0].set_title("Temperature vs Load (Correlation Expected)")
axes[1,0].set_xlabel("Load %")
axes[1,0].set_ylabel("Temperature °C")

# Plot 4 - Downtime vs Failure History (should scale together)
axes[1,1].scatter(machines["Failure_History_Count"], machines["Downtime_Hours_Last_Year"],
                  color="purple")
axes[1,1].set_title("Downtime vs Failure History (Scaling Expected)")
axes[1,1].set_xlabel("Failure History Count")
axes[1,1].set_ylabel("Downtime Hours")

plt.tight_layout()
plt.savefig("distribution_analysis.png")
plt.show()
print("✅ Distribution plots saved")
