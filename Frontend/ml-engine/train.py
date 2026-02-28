import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, f1_score
import joblib
import os

def train_model():
    print("Loading data...")
    try:
        df = pd.read_csv('../data/machines.csv')
    except Exception as e:
        print("Could not load data:", e)
        return

    # Features and target
    X = df[['TotalRunHours', 'VibrationLevel', 'TempLevel', 'LastMaintenanceDays', 'CapacityPerHour']]
    y = df['FailureLabel']

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    
    print(f"Model trained! Accuracy: {acc:.2f}, F1: {f1:.2f}")

    os.makedirs('models', exist_ok=True)
    joblib.dump(model, 'models/rf_model.pkl')
    print("Model saved to models/rf_model.pkl")

if __name__ == '__main__':
    train_model()
