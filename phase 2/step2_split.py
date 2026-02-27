import os
import pandas as pd
from sklearn.model_selection import train_test_split

BASE = os.path.dirname(os.path.abspath(__file__))

df = pd.read_csv(os.path.join(BASE, "machines_featured.csv"))

DROP_COLS = ["Machine_ID", "Machine_Type", "Installation_Year",
             "Failure_Label", "Remaining_Useful_Life_Hours"]

X = df.drop(columns=DROP_COLS)
y = df["Failure_Label"]

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

X_train.to_csv(os.path.join(BASE, "X_train.csv"), index=False)
X_test.to_csv(os.path.join(BASE,  "X_test.csv"),  index=False)
y_train.to_csv(os.path.join(BASE, "y_train.csv"), index=False)
y_test.to_csv(os.path.join(BASE,  "y_test.csv"),  index=False)

print(f"Step 2 done — Train: {X_train.shape}, Test: {X_test.shape}")
print(f"  Healthy(0): {(y==0).sum()}  |  At Risk(1): {(y==1).sum()}")
