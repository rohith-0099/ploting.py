// Embedded machine data (fallback for offline mode)
const MACHINES_DATA = [
  { MachineID: 'M001', MachineType: 'CNC',     TotalRunHours: 22483.57, VibrationLevel: 3.79, TempLevel: 83.95, LastMaintenanceDays: 67,  CapacityPerHour: 27, FailureLabel: 1 },
  { MachineID: 'M002', MachineType: 'CNC',     TotalRunHours: 18829.23, VibrationLevel: 0.76, TempLevel: 94.65, LastMaintenanceDays: 135, CapacityPerHour: 18, FailureLabel: 0 },
  { MachineID: 'M003', MachineType: 'Milling', TotalRunHours: 27896.06, VibrationLevel: 0.59, TempLevel: 98.80, LastMaintenanceDays: 62,  CapacityPerHour: 44, FailureLabel: 1 },
  { MachineID: 'M004', MachineType: 'Milling', TotalRunHours: 17652.63, VibrationLevel: 1.32, TempLevel: 67.34, LastMaintenanceDays: 54,  CapacityPerHour: 37, FailureLabel: 0 },
  { MachineID: 'M005', MachineType: 'CNC',     TotalRunHours: 21209.81, VibrationLevel: 2.44, TempLevel: 71.65, LastMaintenanceDays: 26,  CapacityPerHour: 15, FailureLabel: 0 },
  { MachineID: 'M006', MachineType: 'CNC',     TotalRunHours: 14935.84, VibrationLevel: 1.81, TempLevel: 74.65, LastMaintenanceDays: 121, CapacityPerHour: 42, FailureLabel: 0 },
  { MachineID: 'M007', MachineType: 'Milling', TotalRunHours: 27328.24, VibrationLevel: 1.40, TempLevel: 80.57, LastMaintenanceDays: 23,  CapacityPerHour: 22, FailureLabel: 0 },
  { MachineID: 'M008', MachineType: 'Lathe',   TotalRunHours: 17278.09, VibrationLevel: 3.23, TempLevel: 66.82, LastMaintenanceDays: 289, CapacityPerHour: 24, FailureLabel: 0 },
  { MachineID: 'M009', MachineType: 'Milling', TotalRunHours: 16996.81, VibrationLevel: 3.58, TempLevel: 77.61, LastMaintenanceDays: 239, CapacityPerHour: 27, FailureLabel: 0 },
  { MachineID: 'M010', MachineType: 'CNC',     TotalRunHours: 19932.51, VibrationLevel: 0.65, TempLevel: 96.37, LastMaintenanceDays: 13,  CapacityPerHour: 37, FailureLabel: 0 },
  { MachineID: 'M011', MachineType: 'Lathe',   TotalRunHours: 24112.72, VibrationLevel: 1.90, TempLevel: 80.80, LastMaintenanceDays: 184, CapacityPerHour: 19, FailureLabel: 0 },
  { MachineID: 'M012', MachineType: 'Lathe',   TotalRunHours: 13359.07, VibrationLevel: 4.86, TempLevel: 91.01, LastMaintenanceDays: 120, CapacityPerHour: 16, FailureLabel: 1 },
  { MachineID: 'M013', MachineType: 'Lathe',   TotalRunHours: 23692.33, VibrationLevel: 0.90, TempLevel: 67.84, LastMaintenanceDays: 57,  CapacityPerHour: 16, FailureLabel: 0 },
  { MachineID: 'M014', MachineType: 'Lathe',   TotalRunHours: 19421.76, VibrationLevel: 2.25, TempLevel: 70.85, LastMaintenanceDays: 193, CapacityPerHour: 48, FailureLabel: 0 },
  { MachineID: 'M015', MachineType: 'CNC',     TotalRunHours: 17696.81, VibrationLevel: 1.76, TempLevel: 81.71, LastMaintenanceDays: 145, CapacityPerHour: 39, FailureLabel: 0 },
  { MachineID: 'M016', MachineType: 'CNC',     TotalRunHours: 21620.42, VibrationLevel: 0.84, TempLevel: 99.48, LastMaintenanceDays: 284, CapacityPerHour: 34, FailureLabel: 0 },
  { MachineID: 'M017', MachineType: 'Milling', TotalRunHours: 16615.39, VibrationLevel: 0.52, TempLevel: 92.62, LastMaintenanceDays: 50,  CapacityPerHour: 28, FailureLabel: 0 },
  { MachineID: 'M018', MachineType: 'Milling', TotalRunHours: 25155.00, VibrationLevel: 3.97, TempLevel: 62.96, LastMaintenanceDays: 195, CapacityPerHour: 22, FailureLabel: 1 },
  { MachineID: 'M019', MachineType: 'CNC',     TotalRunHours: 15803.91, VibrationLevel: 4.38, TempLevel: 84.93, LastMaintenanceDays: 45,  CapacityPerHour: 24, FailureLabel: 1 },
  { MachineID: 'M020', MachineType: 'CNC',     TotalRunHours: 17604.13, VibrationLevel: 1.90, TempLevel: 73.01, LastMaintenanceDays: 158, CapacityPerHour: 24, FailureLabel: 0 },
];
export default MACHINES_DATA;
