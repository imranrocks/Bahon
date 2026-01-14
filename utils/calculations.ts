
import { Bike, FuelLog, TankStatus, CostDisplayType, OilGrade } from '../types';

export const calculateFuelStats = (logs: FuelLog[]) => {
  if (logs.length < 2) return { avgMileage: 0, costPerKm: 0, totalFuelCost: 0, lastFuel: null, validIntervals: 0, bestMileage: 0, worstMileage: 0, mileageHistory: [] as number[] };

  const sorted = [...logs].sort((a, b) => a.odo - b.odo);
  const lastFuel = sorted[sorted.length - 1];
  
  let validDistanceTotal = 0;
  let validLitersTotal = 0;
  let validIntervals = 0;
  let bestMileage = 0;
  let worstMileage = Infinity;
  const mileageHistory: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    
    const currentIsFull = current.tankStatus !== TankStatus.PARTIAL;
    const prevIsFull = prev.tankStatus !== TankStatus.PARTIAL;

    if (currentIsFull && prevIsFull) {
      const dist = current.odo - prev.odo;
      if (dist > 0) {
        const intervalMileage = dist / current.liters;
        validDistanceTotal += dist;
        validLitersTotal += current.liters;
        validIntervals++;
        mileageHistory.push(intervalMileage);
        
        if (intervalMileage > bestMileage) bestMileage = intervalMileage;
        if (intervalMileage < worstMileage) worstMileage = intervalMileage;
      }
    }
  }

  const avgMileage = validLitersTotal > 0 ? validDistanceTotal / validLitersTotal : 0;
  const totalFuelCost = sorted.reduce((sum, log) => sum + log.totalCost, 0);
  const totalDistance = sorted[sorted.length - 1].odo - sorted[0].odo;
  const costPerKm = totalDistance > 0 ? totalFuelCost / totalDistance : 0;

  return { avgMileage, costPerKm, totalFuelCost, lastFuel, validIntervals, bestMileage, worstMileage: worstMileage === Infinity ? 0 : worstMileage, mileageHistory };
};

export const getAggregatedStats = (bike: Bike, costType: CostDisplayType = 'TOTAL') => {
  const fuelStats = calculateFuelStats(bike.fuelLogs);
  const oilCost = bike.oilLogs.reduce((sum, l) => sum + l.cost, 0);
  const maintCost = bike.maintenanceLogs.reduce((sum, l) => sum + l.cost + l.laborCost, 0);
  
  const currentOdo = Math.max(
    bike.initialOdo,
    ...bike.fuelLogs.map(l => l.odo),
    ...bike.oilLogs.map(l => l.odo),
    ...bike.maintenanceLogs.map(l => l.odo),
    0
  );
  
  const distanceTotal = currentOdo - bike.initialOdo;
  let displayCostPerKm = 0;
  if (distanceTotal > 0) {
    if (costType === 'FUEL') displayCostPerKm = fuelStats.totalFuelCost / distanceTotal;
    else if (costType === 'FUEL_OIL') displayCostPerKm = (fuelStats.totalFuelCost + oilCost) / distanceTotal;
    else displayCostPerKm = (fuelStats.totalFuelCost + oilCost + maintCost) / distanceTotal;
  }

  // AI Station Logic
  const stationStats: Record<string, { dist: number, lit: number }> = {};
  bike.fuelLogs.forEach((log, i) => {
    if (i > 0 && log.stationName && log.tankStatus !== TankStatus.PARTIAL && bike.fuelLogs[i-1].tankStatus !== TankStatus.PARTIAL) {
        const dist = log.odo - bike.fuelLogs[i-1].odo;
        if (!stationStats[log.stationName]) stationStats[log.stationName] = { dist: 0, lit: 0 };
        stationStats[log.stationName].dist += dist;
        stationStats[log.stationName].lit += log.liters;
    }
  });

  const now = new Date();
  const monthlySpent = bike.fuelLogs.filter(l => new Date(l.date).getMonth() === now.getMonth()).reduce((s, l) => s + l.totalCost, 0) +
                        bike.oilLogs.filter(l => new Date(l.date).getMonth() === now.getMonth()).reduce((s, l) => s + l.cost, 0) +
                        bike.maintenanceLogs.filter(l => new Date(l.date).getMonth() === now.getMonth()).reduce((s, l) => s + l.cost + l.laborCost, 0);

  return {
    totalSpent: fuelStats.totalFuelCost + oilCost + maintCost,
    monthlySpent,
    fuelCost: fuelStats.totalFuelCost,
    oilCost,
    maintenanceCost: maintCost,
    avgMileage: fuelStats.avgMileage,
    mileageHistory: fuelStats.mileageHistory,
    bestMileage: fuelStats.bestMileage,
    worstMileage: fuelStats.worstMileage,
    costPerKmTotal: displayCostPerKm,
    currentOdo,
    stationStats,
    fuelEntriesCount: bike.fuelLogs.length
  };
};
