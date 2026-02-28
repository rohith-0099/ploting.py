/**
 * Pure-JS fallback scheduler (Phase 4 logic)
 * Used when the Flask backend is offline.
 */

const PRIORITY_WEIGHT = { Critical: 4, High: 3, Medium: 2, Low: 1 };

export function runScheduler(jobs, machines, predictions, weights) {
  const w1 = (weights.w1 || 0.5);
  const w2 = (weights.w2 || 0.3);
  const w3 = (weights.w3 || 0.2);
  const total = w1 + w2 + w3 || 1;
  const [nw1, nw2, nw3] = [w1 / total, w2 / total, w3 / total];

  const maxRev  = Math.max(...jobs.map(j => j.Revenue));
  const maxTime = Math.max(...jobs.map(j => j.ProcessingTimeHours));
  const fpMap   = Object.fromEntries(predictions.map(p => [p.MachineID, p.Failure_Prob]));

  // Sort: Critical first, then by Revenue desc
  const sorted = [...jobs].sort((a, b) => {
    const pd = (PRIORITY_WEIGHT[b.Priority] || 1) - (PRIORITY_WEIGHT[a.Priority] || 1);
    return pd !== 0 ? pd : b.Revenue - a.Revenue;
  });

  const machineSlot   = Object.fromEntries(machines.map(m => [m.MachineID, 0]));
  const scheduled     = [];
  const deferred      = [];

  for (const job of sorted) {
    const eligible = machines.filter(m => m.MachineType === job.RequiredMachineType);

    if (!eligible.length) {
      deferred.push({ ...job, DeferReason: `No ${job.RequiredMachineType} machine available`, DeferCategory: 'No Machine Type' });
      continue;
    }

    let best = null;
    for (const mach of eligible) {
      const fp    = fpMap[mach.MachineID] ?? 0.2;
      const start = machineSlot[mach.MachineID];
      const end   = start + job.ProcessingTimeHours;
      if (end > job.DeadlineHours) continue;

      const revNorm  = job.Revenue / maxRev;
      const timeNorm = job.ProcessingTimeHours / maxTime;
      const prioNorm = (PRIORITY_WEIGHT[job.Priority] || 1) / 4;
      const score    = nw1 * (revNorm * 0.7 + prioNorm * 0.3) - nw2 * fp - nw3 * timeNorm;

      if (!best || score > best.score) {
        best = { machineId: mach.MachineID, machineType: mach.MachineType, fp, start, end, score: +score.toFixed(4) };
      }
    }

    if (!best) {
      deferred.push({
        ...job,
        DeferReason: `Cannot meet ${job.DeadlineHours}h deadline on any ${job.RequiredMachineType} machine`,
        DeferCategory: 'Deadline Conflict',
      });
    } else {
      machineSlot[best.machineId] = best.end;
      scheduled.push({
        ...job,
        AssignedMachine: best.machineId,
        MachineType:     best.machineType,
        StartTime:       +best.start.toFixed(2),
        EndTime:         +best.end.toFixed(2),
        FailureProb:     +best.fp.toFixed(3),
        Score:           best.score,
        RevenueContrib:  +job.Revenue.toFixed(2),
        CostEstimate:    +(job.ProcessingTimeHours * 85).toFixed(2),
        ScoreBreakdown: {
          throughput: +(nw1 * (job.Revenue / maxRev * 0.7 + (PRIORITY_WEIGHT[job.Priority] || 1) / 4 * 0.3)).toFixed(4),
          risk:       +(-nw2 * best.fp).toFixed(4),
          cost:       +(-nw3 * job.ProcessingTimeHours / maxTime).toFixed(4),
          total:      best.score,
        },
        Justification: `Assigned to ${best.machineId}: score=${best.score} | risk=${best.fp.toFixed(2)} | window=${best.start.toFixed(1)}h–${best.end.toFixed(1)}h`,
      });
    }
  }

  const totalRevenue = scheduled.reduce((s, j) => s + j.RevenueContrib, 0);
  const totalCost    = scheduled.reduce((s, j) => s + j.CostEstimate, 0);
  const avgRisk      = scheduled.length ? scheduled.reduce((s, j) => s + j.FailureProb, 0) / scheduled.length : 0;

  return {
    schedule: scheduled,
    deferred,
    metrics: {
      totalRevenue:     +totalRevenue.toFixed(2),
      totalCost:        +totalCost.toFixed(2),
      netProfit:        +(totalRevenue - totalCost).toFixed(2),
      avgRisk:          +avgRisk.toFixed(3),
      jobsScheduled:    scheduled.length,
      jobsDeferred:     deferred.length,
      throughputRate:   +(scheduled.length / (scheduled.length + deferred.length) * 100).toFixed(1),
      estimatedDowntime: 0,
    },
  };
}
