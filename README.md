# MECON IntelliOps - AI-Driven Production & Maintenance Platform

MECON IntelliOps is an enterprise-grade, end-to-end industrial platform designed to optimize factory production through Risk-Aware AI scheduling and Predictive Maintenance. The project spans 5 distinct phases, from data engineering to a functional high-performance dashboard.

## 🏗️ Project Architecture

The system is built on a multi-layered intelligence pipeline:

1.  **Phase 1: Data Engineering** — Synthesis of industrial datasets for machines, jobs, and cost parameters.
2.  **Phase 2: Predictive Modeling** — ML pipeline (Random Forest/Meta-Models) predicting machine failure probability with SHAP explainability.
3.  **Phase 3: Maintenance Simulation** — Scenario-based cost analysis (Preventive vs. Corrective) to optimize maintenance windows.
4.  **Phase 4: Optimization Engine** — Mathematical scheduler balancing Throughput (Revenue), Risk (Failure Prob), and Cost.
5.  **Phase 5: Industrial UI** — High-performance React + FastAPI dashboard with real-time operational and management controls.

---

## 🚀 Key Features

### 📦 Operational Intelligence (Layer 1)
*   **Machine Inspector**: Deep-dive into individual machine health using SHAP AI explainability.
*   **Interactive Job Submission**: Operators can submit new jobs. The AI ranks the best machines based on a dynamic revenue/risk/priority score.

### 🏢 Management Dashboard (Layer 2)
*   **Fleet Oversight**: Live utilization and health breakdown by machine type (CNC, Welding, etc.).
*   **Production Overrides**: Manual allocation engine allowing managers to force-assign jobs to machines with live risk assessments.
*   **Capacity Expansion**: Onboard new machines with custom vibration/age profiles and see the instant impact on fleet capacity.

### 💾 Data Persistence
*   All custom submitted entries are stored in `phase 1/custom_jobs.csv` and `phase 1/custom_machines.csv`, ensuring data survives system restarts.

---

## 🛠️ Technical Stack

-   **Backend**: Python, FastAPI, Pandas, NumPy, Scikit-Learn
-   **Frontend**: React (Vite), Tailwind CSS, Recharts, Lucide Icons
-   **Architecture**: RESTful API / Micro-services design
-   **Design Philosophy**: Industrial-Luxury Dark Theme

---

## 🏁 Getting Started

### Prerequisites
- Python 3.9+
- Node.js & npm

### 1. Start the Python Backend
```bash
cd /home/rohith/Desktop/ploting.py
# Set up venv if needed
source venv/bin/activate
# Run backend
uvicorn Frontend.fastapi_backend.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the React Frontend
```bash
cd /home/rohith/Desktop/ploting.py/Frontend/frontend
npm install
npm run dev -- --port 5173
```

Access the dashboard at: **http://localhost:5173**

---

## 📈 Dashboard Layout
-   **Overview**: Executive summary with KPIs and critical machine grid.
-   **Operator Interface**: Machine inspection and AI-driven job submission.
-   **Maintenance Sim**: Simulation tools for PM vs CM strategies.
-   **Optimization Engine**: Live weight tuning for the production scheduler.
-   **Production Schedule**: Detailed Gantt Chart of assigned work.
-   **Management Dashboard**: Fleet util, manual overrides, and machine onboarding.

---

## 👨‍💻 Project Structure
```text
.
├── phase 1/            # Ground truth Data & Custom CSVs
├── phase 2/            # ML Training & Prediction pipeline
├── phase 3/            # Maintenance Simulation logic
├── phase 4/            # Optimization & Scheduling scripts
└── Frontend/
    ├── fastapi_backend/# FastAPI Server (main.py)
    └── frontend/       # React Source Code
```
