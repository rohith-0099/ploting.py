from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import pandas as pd
import numpy as np
import io
import os

app = Flask(__name__)
CORS(app)

# ── Path resolution ──────────────────────────────────────────────────────────
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
DATA_DIR   = os.path.join(BASE_DIR, '..', '..', 'data')

# ── Load CSVs once at startup ─────────────────────────────────────────────────
machines    = pd.read_csv(os.path.join(DATA_DIR, 'machines.csv'))
jobs        = pd.read_csv(os.path.join(DATA_DIR, 'jobs.csv'))
predictions = pd.read_csv(os.path.join(DATA_DIR, 'predictions.csv'))
scenarios   = pd.read_csv(os.path.join(DATA_DIR, 'phase3_machine_scenarios.csv'))

PRIORITY_WEIGHT = {'Critical': 4, 'High': 3, 'Medium': 2, 'Low': 1}

# ── Phase-4 Greedy Scheduler ─────────────────────────────────────────────────
def run_scheduler(weights):
    w1 = float(weights.get('w1', 0.5))   # Throughput / Revenue
    w2 = float(weights.get('w2', 0.3))   # Risk avoidance
    w3 = float(weights.get('w3', 0.2))   # Cost / time

    # Normalize
    total = w1 + w2 + w3 if (w1 + w2 + w3) > 0 else 1
    w1, w2, w3 = w1 / total, w2 / total, w3 / total

    # Sort jobs: highest priority first → highest revenue second
    jobs_df = jobs.copy()
    jobs_df['PriorityRank'] = jobs_df['Priority'].map(PRIORITY_WEIGHT).fillna(1)
    jobs_sorted = jobs_df.sort_values(
        by=['PriorityRank', 'Revenue'],
        ascending=[False, False]
    ).reset_index(drop=True)

    max_rev  = jobs_df['Revenue'].max()
    max_time = jobs_df['ProcessingTimeHours'].max()

    # Build failure-prob lookup
    fp_map = dict(zip(predictions['MachineID'], predictions['Failure_Prob']))

    # Machine availability tracker: next free hour per machine
    machine_slot = {mid: 0.0 for mid in machines['MachineID']}

    scheduled = []
    deferred  = []

    for _, job in jobs_sorted.iterrows():
        job_dict = {k: (int(v) if isinstance(v, np.integer) else float(v) if isinstance(v, np.floating) else v) for k, v in job.to_dict().items()}
        mtype    = job['RequiredMachineType']
        deadline = float(job['DeadlineHours'])
        proc     = float(job['ProcessingTimeHours'])
        revenue  = float(job['Revenue'])

        eligible = machines[machines['MachineType'] == mtype]

        if eligible.empty:
            job_dict['DeferReason'] = f'No {mtype} machine available in plant'
            job_dict['DeferCategory'] = 'No Machine Type'
            deferred.append(job_dict)
            continue

        best = None
        for _, mach in eligible.iterrows():
            mid       = mach['MachineID']
            fp        = fp_map.get(mid, 0.2)
            start     = machine_slot[mid]
            end       = start + proc

            if end > deadline:
                continue  # Deadline miss

            rev_norm  = revenue / max_rev
            time_norm = proc / max_time
            prio_norm = PRIORITY_WEIGHT.get(job['Priority'], 1) / 4.0
            score     = w1 * (rev_norm * 0.7 + prio_norm * 0.3) - w2 * fp - w3 * time_norm

            if best is None or score > best['score']:
                best = {
                    'machine_id': mid,
                    'machine_type': mach['MachineType'],
                    'fp': fp,
                    'start': round(start, 2),
                    'end':   round(end, 2),
                    'score': round(score, 4),
                }

        if best is None:
            job_dict['DeferReason'] = (
                f'Cannot complete {mtype} job within {deadline}h deadline '
                f'— all {mtype} machines have conflicting schedules'
            )
            job_dict['DeferCategory'] = 'Deadline Conflict'
            deferred.append(job_dict)
        else:
            machine_slot[best['machine_id']] = best['end']
            revenue_contrib  = round(revenue, 2)
            risk_penalty     = round(best['fp'] * 1000, 2)
            cost_estimate    = round(proc * 85, 2)           # $85/hr machining cost

            scheduled.append({
                **job_dict,
                'AssignedMachine':  str(best['machine_id']),
                'MachineType':      str(best['machine_type']),
                'StartTime':        float(best['start']),
                'EndTime':          float(best['end']),
                'FailureProb':      float(round(best['fp'], 3)),
                'Score':            float(best['score']),
                'RevenueContrib':   float(revenue_contrib),
                'RiskPenalty':      float(risk_penalty),
                'CostEstimate':     float(cost_estimate),
                'ScoreBreakdown': {
                    'throughput': float(round(w1 * (revenue / max_rev * 0.7 + PRIORITY_WEIGHT.get(job['Priority'], 1) / 4.0 * 0.3), 4)),
                    'risk':       float(round(-w2 * best['fp'], 4)),
                    'cost':       float(round(-w3 * proc / max_time, 4)),
                    'total':      float(best['score']),
                },
                'Justification': (
                    f"Assigned to {best['machine_id']}: "
                    f"score={best['score']:.3f} | "
                    f"risk={best['fp']:.2f} | "
                    f"window={best['start']:.1f}h–{best['end']:.1f}h"
                ),
            })

    return scheduled, deferred


# ── API Routes ───────────────────────────────────────────────────────────────

@app.route('/api/schedule', methods=['POST'])
def get_schedule():
    weights = request.json.get('weights', {'w1': 0.5, 'w2': 0.3, 'w3': 0.2})
    scheduled, deferred = run_scheduler(weights)

    # Metrics summary
    total_revenue  = sum(j.get('RevenueContrib', 0) for j in scheduled)
    total_cost     = sum(j.get('CostEstimate', 0) for j in scheduled)
    avg_risk       = (sum(j.get('FailureProb', 0) for j in scheduled) / len(scheduled)) if scheduled else 0
    total_downtime = sum(
        float(scenarios[scenarios['MachineID'] == j['AssignedMachine']]['MaintenanceDuration_Hours'].sum())
        for j in scheduled
        if j['AssignedMachine'] in scenarios['MachineID'].values
    )

    total_jobs = len(scheduled) + len(deferred)
    throughput = round(len(scheduled) / total_jobs * 100, 1) if total_jobs > 0 else 0.0

    return jsonify({
        'schedule': scheduled,
        'deferred': deferred,
        'metrics': {
            'totalRevenue':   float(round(total_revenue, 2)),
            'totalCost':      float(round(total_cost, 2)),
            'avgRisk':        float(round(avg_risk, 3)),
            'jobsScheduled':  int(len(scheduled)),
            'jobsDeferred':   int(len(deferred)),
            'throughputRate': float(throughput),
            'estimatedDowntime': float(round(total_downtime, 1)),
            'netProfit':      float(round(total_revenue - total_cost, 2)),
        }
    })


@app.route('/api/high-risk', methods=['GET'])
def get_high_risk():
    threshold = float(request.args.get('threshold', 0.5))
    high_risk = predictions[predictions['Failure_Prob'] > threshold].copy()
    high_risk = high_risk.sort_values('Failure_Prob', ascending=False)
    return jsonify(high_risk.to_dict('records'))


@app.route('/api/machines', methods=['GET'])
def get_machines():
    merged = machines.merge(
        predictions[['MachineID', 'Failure_Prob', 'Risk_Category', 'Recommended_Action']],
        on='MachineID', how='left'
    )
    merged['Failure_Prob']       = merged['Failure_Prob'].fillna(0.2)
    merged['Risk_Category']      = merged['Risk_Category'].fillna('Unknown')
    merged['Recommended_Action'] = merged['Recommended_Action'].fillna('Monitor')
    return jsonify(merged.to_dict('records'))


@app.route('/api/scenarios', methods=['GET'])
def get_scenarios():
    merged = scenarios.merge(
        predictions[['MachineID', 'Failure_Prob', 'Risk_Category']],
        on='MachineID', how='left'
    )
    return jsonify(merged.to_dict('records'))


@app.route('/api/export', methods=['POST'])
def export_schedule():
    weights  = request.json.get('weights', {'w1': 0.5, 'w2': 0.3, 'w3': 0.2})
    scheduled, deferred = run_scheduler(weights)

    sched_df = pd.DataFrame(scheduled)
    defer_df = pd.DataFrame(deferred)

    output = io.StringIO()
    output.write("=== SCHEDULED JOBS ===\n")
    if not sched_df.empty:
        sched_df.drop(columns=['ScoreBreakdown'], errors='ignore').to_csv(output, index=False)
    output.write("\n=== DEFERRED JOBS ===\n")
    if not defer_df.empty:
        defer_df.to_csv(output, index=False)

    output.seek(0)
    return send_file(
        io.BytesIO(output.getvalue().encode()),
        mimetype='text/csv',
        as_attachment=True,
        download_name='mecon_phase5_schedule.csv'
    )


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'machines': len(machines),
        'jobs': len(jobs),
        'predictions': len(predictions),
    })


if __name__ == '__main__':
    print("🚀 MECON Phase 5 Backend starting on http://localhost:5000")
    print(f"   Machines: {len(machines)} | Jobs: {len(jobs)} | Predictions: {len(predictions)}")
    app.run(port=5000, debug=True)
