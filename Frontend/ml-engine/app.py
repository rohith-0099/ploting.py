from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import pulp
import math

app = Flask(__name__)
CORS(app)

# Load model on startup
try:
    model = joblib.load('models/rf_model.pkl')
except:
    model = None
    print("Warning: Model not found. Run train.py first.")

@app.route('/predict', methods=['POST'])
def predict():
    """
    Predict failure for given machine data
    """
    if not model:
        return jsonify({"error": "Model not loaded"}), 500
        
    data = request.json
    try:
        df = pd.DataFrame(data)
        # Select appropriate features
        features = df[['TotalRunHours', 'VibrationLevel', 'TempLevel', 'LastMaintenanceDays', 'CapacityPerHour']]
        
        # Predictions
        predictions = model.predict(features)
        probabilities = model.predict_proba(features)[:, 1] # Probability of failure
        
        results = []
        for i, (pred, prob) in enumerate(zip(predictions, probabilities)):
            health_score = max(0, min(100, 100 * (1 - prob)))
            results.append({
                "MachineID": data[i].get("MachineID", f"Unknown_{i}"),
                "FailurePrediction": int(pred),
                "FailureProbability": float(prob),
                "HealthScore": round(health_score, 2),
                "RiskLevel": "High" if prob > 0.7 else "Medium" if prob > 0.4 else "Low"
            })
            
        return jsonify(results)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@app.route('/simulate', methods=['POST'])
def simulate():
    """
    Simulate maintenance impact
    Immediate vs Delayed
    """
    data = request.json
    machine = data.get('machine')
    scenario = data.get('scenario', 'immediate') # immediate or delayed
    
    # Simple simulation logic based on Phase 3 requirements
    maint_duration = 4 # hours
    downtime_cost_per_hour = 500
    
    prob_failure = machine.get('FailureProbability', 0.1)
    capacity = machine.get('CapacityPerHour', 20)
    
    if scenario == 'immediate':
        downtime = maint_duration
        preventive_cost = 1000
        total_cost = preventive_cost + (downtime * downtime_cost_per_hour)
        capacity_loss = downtime * capacity
        risk_after = 0.05
    else:
        # Delayed
        delay_hours = data.get('delay_hours', 24)
        failure_risk_multiplier = 1.0 + (delay_hours / 24) * 0.5 
        adjusted_prob = min(0.99, prob_failure * failure_risk_multiplier)
        
        expected_downtime = maint_duration + (adjusted_prob * 10) # 10 extra hours if it fails
        corrective_cost = 5000 * adjusted_prob
        total_cost = corrective_cost + (expected_downtime * downtime_cost_per_hour)
        capacity_loss = expected_downtime * capacity
        risk_after = adjusted_prob
        
    return jsonify({
        "Scenario": scenario,
        "ExpectedDowntime": round(downtime if scenario == 'immediate' else expected_downtime, 2),
        "TotalCost": round(total_cost, 2),
        "CapacityLoss": round(capacity_loss, 2),
        "RiskAfter": round(risk_after, 2)
    })

@app.route('/optimize', methods=['POST'])
def optimize():
    """
    Phase 4: Scheduling optimization using Greedy Heuristic
    Assigns jobs to machines based on weights.
    """
    data = request.json
    jobs = data.get('jobs', [])
    machines = data.get('machines', [])
    weights = data.get('weights', {'throughput': 0.5, 'failure_risk': 0.3, 'cost': 0.2})
    
    # Sort machines by HealthScore (or 1 - failure probability)
    machines_sorted = sorted(machines, key=lambda x: x.get('HealthScore', 50), reverse=True)
    
    # Sort jobs by Priority and Deadline
    priority_map = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1}
    jobs_sorted = sorted(jobs, key=lambda x: (priority_map.get(x.get('Priority', 'Low'), 1), -x.get('DeadlineHours', 100)), reverse=True)
    
    schedule = []
    deferrals = []
    
    machine_availability = {m['MachineID']: 0 for m in machines} # Hours currently scheduled
    
    for job in jobs_sorted:
        assigned = False
        req_type = job.get('RequiredMachineType')
        proc_time = job.get('ProcessingTimeHours', 0)
        
        # Find best machine
        # We consider the objective function weights here for a score 
        best_machine = None
        best_score = -float('inf')
        
        for m in machines_sorted:
            if m.get('MachineType') != req_type:
                continue
                
            available_after = machine_availability[m['MachineID']]
            if available_after + proc_time > job.get('DeadlineHours', 999):
                 continue # Misses deadline
                 
            # Calculate objective score for this assignment
            w_throughput = weights.get('throughput', 0.5)
            w_risk = weights.get('failure_risk', 0.3)
            w_cost = weights.get('cost', 0.2)
            
            throughput_val = m.get('CapacityPerHour', 10) * proc_time
            risk_val = m.get('FailureProbability', 0.5) * 100 # penalty
            cost_val = (proc_time * 50) # simple cost heuristic
            
            score = (w_throughput * throughput_val) - (w_risk * risk_val) - (w_cost * cost_val)
            
            if score > best_score:
                best_score = score
                best_machine = m
                
        if best_machine:
            # High risk rejection logic
            if best_machine.get('FailureProbability', 0) > 0.8 and job.get('Priority') != 'Critical':
                deferrals.append({"JobID": job['JobID'], "Reason": "Too high risk on available machines."})
                continue
                
            schedule.append({
                "JobID": job['JobID'],
                "MachineID": best_machine['MachineID'],
                "StartTime": machine_availability[best_machine['MachineID']],
                "EndTime": machine_availability[best_machine['MachineID']] + proc_time,
                "Score": round(best_score, 2)
            })
            machine_availability[best_machine['MachineID']] += proc_time
            assigned = True
            
        if not assigned:
            deferrals.append({"JobID": job['JobID'], "Reason": "No suitable machine found meeting deadline/type constraints."})
            
    return jsonify({
        "Schedule": schedule,
        "Deferrals": deferrals,
        "Metrics": {
            "TotalScheduled": len(schedule),
            "TotalDeferred": len(deferrals)
        }
    })

if __name__ == '__main__':
    app.run(port=5000, debug=True)
