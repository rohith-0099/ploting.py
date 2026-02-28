// Embedded predictions data (fallback for offline mode)
const PREDICTIONS_DATA = [
  { MachineID: 'M001', MachineType: 'CNC',     Failure_Prob: 0.85, Risk_Category: 'Critical', Recommended_Action: 'Immediate maintenance required',         LastMaintenanceDays: 67,  VibrationLevel: 3.79, TempLevel: 83.95 },
  { MachineID: 'M002', MachineType: 'CNC',     Failure_Prob: 0.30, Risk_Category: 'Low',      Recommended_Action: 'Schedule routine inspection',            LastMaintenanceDays: 135, VibrationLevel: 0.76, TempLevel: 94.65 },
  { MachineID: 'M003', MachineType: 'Milling', Failure_Prob: 0.78, Risk_Category: 'High',     Recommended_Action: 'Maintenance within 48h',                 LastMaintenanceDays: 62,  VibrationLevel: 0.59, TempLevel: 98.80 },
  { MachineID: 'M004', MachineType: 'Milling', Failure_Prob: 0.22, Risk_Category: 'Low',      Recommended_Action: 'Monitor normally',                       LastMaintenanceDays: 54,  VibrationLevel: 1.32, TempLevel: 67.34 },
  { MachineID: 'M005', MachineType: 'CNC',     Failure_Prob: 0.43, Risk_Category: 'Medium',   Recommended_Action: 'Inspect vibration dampers',              LastMaintenanceDays: 26,  VibrationLevel: 2.44, TempLevel: 71.65 },
  { MachineID: 'M006', MachineType: 'CNC',     Failure_Prob: 0.28, Risk_Category: 'Low',      Recommended_Action: 'Schedule routine inspection',            LastMaintenanceDays: 121, VibrationLevel: 1.81, TempLevel: 74.65 },
  { MachineID: 'M007', MachineType: 'Milling', Failure_Prob: 0.27, Risk_Category: 'Low',      Recommended_Action: 'Monitor normally',                       LastMaintenanceDays: 23,  VibrationLevel: 1.40, TempLevel: 80.57 },
  { MachineID: 'M008', MachineType: 'Lathe',   Failure_Prob: 0.58, Risk_Category: 'High',     Recommended_Action: 'Inspect bearings - overdue service',     LastMaintenanceDays: 289, VibrationLevel: 3.23, TempLevel: 66.82 },
  { MachineID: 'M009', MachineType: 'Milling', Failure_Prob: 0.61, Risk_Category: 'High',     Recommended_Action: 'Service overdue - vibration high',       LastMaintenanceDays: 239, VibrationLevel: 3.58, TempLevel: 77.61 },
  { MachineID: 'M010', MachineType: 'CNC',     Failure_Prob: 0.24, Risk_Category: 'Low',      Recommended_Action: 'Monitor normally',                       LastMaintenanceDays: 13,  VibrationLevel: 0.65, TempLevel: 96.37 },
  { MachineID: 'M011', MachineType: 'Lathe',   Failure_Prob: 0.42, Risk_Category: 'Medium',   Recommended_Action: 'Check lubrication system',               LastMaintenanceDays: 184, VibrationLevel: 1.90, TempLevel: 80.80 },
  { MachineID: 'M012', MachineType: 'Lathe',   Failure_Prob: 0.92, Risk_Category: 'Critical', Recommended_Action: 'Take offline immediately - failure imminent', LastMaintenanceDays: 120, VibrationLevel: 4.86, TempLevel: 91.01 },
  { MachineID: 'M013', MachineType: 'Lathe',   Failure_Prob: 0.18, Risk_Category: 'Low',      Recommended_Action: 'Monitor normally',                       LastMaintenanceDays: 57,  VibrationLevel: 0.90, TempLevel: 67.84 },
  { MachineID: 'M014', MachineType: 'Lathe',   Failure_Prob: 0.38, Risk_Category: 'Medium',   Recommended_Action: 'Check service schedule',                 LastMaintenanceDays: 193, VibrationLevel: 2.25, TempLevel: 70.85 },
  { MachineID: 'M015', MachineType: 'CNC',     Failure_Prob: 0.33, Risk_Category: 'Low',      Recommended_Action: 'Schedule routine inspection',            LastMaintenanceDays: 145, VibrationLevel: 1.76, TempLevel: 81.71 },
  { MachineID: 'M016', MachineType: 'CNC',     Failure_Prob: 0.55, Risk_Category: 'High',     Recommended_Action: 'Temperature critical - check cooling',   LastMaintenanceDays: 284, VibrationLevel: 0.84, TempLevel: 99.48 },
  { MachineID: 'M017', MachineType: 'Milling', Failure_Prob: 0.26, Risk_Category: 'Low',      Recommended_Action: 'Monitor normally',                       LastMaintenanceDays: 50,  VibrationLevel: 0.52, TempLevel: 92.62 },
  { MachineID: 'M018', MachineType: 'Milling', Failure_Prob: 0.82, Risk_Category: 'Critical', Recommended_Action: 'Immediate maintenance required',         LastMaintenanceDays: 195, VibrationLevel: 3.97, TempLevel: 62.96 },
  { MachineID: 'M019', MachineType: 'CNC',     Failure_Prob: 0.87, Risk_Category: 'Critical', Recommended_Action: 'Take offline - failure predicted',       LastMaintenanceDays: 45,  VibrationLevel: 4.38, TempLevel: 84.93 },
  { MachineID: 'M020', MachineType: 'CNC',     Failure_Prob: 0.32, Risk_Category: 'Low',      Recommended_Action: 'Schedule routine inspection',            LastMaintenanceDays: 158, VibrationLevel: 1.90, TempLevel: 73.01 },
];
export default PREDICTIONS_DATA;
