import { Bike, FuelLog, CostDisplayType } from '../types';

export const calculateFuelStats = (logs: FuelLog[]) => {
  // কমপক্ষে ২ টি বৈধ লগ না থাকলে মাইলেজ আসবে না
  const validLogs = logs.filter(l => l.isMileageValid).sort((a, b) => a.odo - b.odo);
  
  if (validLogs.length < 2) {
    return { avgMileage: 0, costPerKm: 0, totalFuelCost: 0, lastFuel: null, validIntervals: 0, bestMileage: 0, worstMileage: 0, mileageHistory: [] as number[] };
  }

  const lastFuel = validLogs[validLogs.length - 1];
  const firstFuel = validLogs[0];

  const totalDistance = lastFuel.odo - firstFuel.odo;
  // প্রথম এন্ট্রি বাদে বাকিগুলোর তেলের যোগফল
  const totalLiters = validLogs.slice(1).reduce((sum, log) => sum + log.liters, 0);
  const totalFuelCost = logs.reduce((sum, log) => sum + log.totalCost, 0);

  const avgMileage = totalLiters > 0 ? totalDistance / totalLiters : 0;

  let bestMileage = 0;
  let worstMileage = Infinity;
  const mileageHistory: number[] = [];

  for (let i = 1; i < validLogs.length; i++) {
    const dist = validLogs[i].odo - validLogs[i - 1].odo;
    if (dist > 0 && validLogs[i].liters > 0) {
      const currentMPG = dist / validLogs[i].liters;
      mileageHistory.push(currentMPG);
      if (currentMPG > bestMileage) bestMileage = currentMPG;
      if (currentMPG < worstMileage) worstMileage = currentMPG;
    }
  }

  return { 
    avgMileage, 
    totalFuelCost, 
    lastFuel, 
    validIntervals: validLogs.length - 1, 
    bestMileage, 
    worstMileage: worstMileage === Infinity ? 0 : worstMileage, 
    mileageHistory 
  };
};

export const getAggregatedStats = (bike: Bike, costType: CostDisplayType = 'TOTAL') => {
  const fuelStats = calculateFuelStats(bike.fuelLogs);
  const totalOilCost = bike.oilLogs.reduce((sum, l) => sum + l.cost, 0);
  const totalMaintCost = bike.maintenanceLogs.reduce((sum, l) => sum + l.cost + l.laborCost, 0);
  
  const currentOdo = Math.max(
    bike.initialOdo,
    ...bike.fuelLogs.map(l => l.odo),
    ...bike.oilLogs.map(l => l.odo),
    ...bike.maintenanceLogs.map(l => l.odo),
    0
  );
  
  const distanceTotal = currentOdo - bike.initialOdo;
  let displayCostPerKm = 0;
  const lastFuelPrice = fuelStats.lastFuel?.pricePerLiter || 0;
  
  // ১. খরচ বিশ্লেষণ (Cost/KM Logic)
  if (fuelStats.avgMileage > 0 && lastFuelPrice > 0) {
    const currentFuelCostPerKm = lastFuelPrice / fuelStats.avgMileage;
    if (costType === 'FUEL') {
      displayCostPerKm = currentFuelCostPerKm;
    } else if (costType === 'FUEL_OIL') {
      const lifetimeOilCostPerKm = distanceTotal > 0 ? totalOilCost / distanceTotal : 0;
      displayCostPerKm = currentFuelCostPerKm + lifetimeOilCostPerKm;
    } else {
      const lifetimeMaintAndOilPerKm = distanceTotal > 0 ? (totalOilCost + totalMaintCost) / distanceTotal : 0;
      displayCostPerKm = currentFuelCostPerKm + lifetimeMaintAndOilPerKm;
    }
  }

  // ২. AI স্টেশন ট্র্যাকিং (Station Analysis)
  const stationStats: Record<string, { dist: number, lit: number }> = {};
  const sortedFuel = [...bike.fuelLogs].sort((a, b) => a.odo - b.odo);
  sortedFuel.forEach((log, i) => {
    if (i > 0 && log.stationName && log.isMileageValid) {
        const prevLog = sortedFuel[i-1];
        const dist = log.odo - prevLog.odo;
        if (!stationStats[log.stationName]) stationStats[log.stationName] = { dist: 0, lit: 0 };
        stationStats[log.stationName].dist += dist;
        stationStats[log.stationName].lit += log.liters;
    }
  });

  // ৩. মাসিক খরচ (Current Month Breakdown)
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const isThisMonth = (dateString: string) => {
    const d = new Date(dateString);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  const monthlyFuelCost = bike.fuelLogs.filter(l => isThisMonth(l.date)).reduce((s, l) => s + l.totalCost, 0);
  const monthlyOilCost = bike.oilLogs.filter(l => isThisMonth(l.date)).reduce((s, l) => s + l.cost, 0);
  const monthlyMaintCost = bike.maintenanceLogs.filter(l => isThisMonth(l.date)).reduce((s, l) => s + l.cost + l.laborCost, 0);

  // ৪. AI মোস্ট এক্সপেন্সিভ পার্ট
  const sortedParts = [...bike.maintenanceLogs].sort((a, b) => (b.cost + b.laborCost) - (a.cost + a.laborCost));
  const mostExpensivePart = sortedParts.length > 0 ? sortedParts[0] : null;

  return {
    totalSpent: fuelStats.totalFuelCost + totalOilCost + totalMaintCost,
    monthlySpent: monthlyFuelCost + monthlyOilCost + monthlyMaintCost,
    fuelCost: monthlyFuelCost,
    oilCost: monthlyOilCost,
    maintenanceCost: monthlyMaintCost,
    avgMileage: fuelStats.avgMileage,
    mileageHistory: fuelStats.mileageHistory,
    bestMileage: fuelStats.bestMileage,
    worstMileage: fuelStats.worstMileage,
    costPerKmTotal: displayCostPerKm,
    currentOdo,
    stationStats,
    mostExpensivePart,
    fuelEntriesCount: bike.fuelLogs.length
  };
};