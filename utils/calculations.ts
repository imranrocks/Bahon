import { Bike, FuelLog, TankStatus, CostDisplayType, OilGrade } from '../types';

export const calculateFuelStats = (logs: FuelLog[]) => {
  // কমপক্ষে ২ টি লগ না থাকলে মাইলেজ আসবে না
  if (logs.length < 2) {
    return { avgMileage: 0, costPerKm: 0, totalFuelCost: 0, lastFuel: null, validIntervals: 0, bestMileage: 0, worstMileage: 0, mileageHistory: [] as number[] };
  }

  // ওডোমিটার অনুযায়ী ডাটা সাজানো
  const sorted = [...logs].sort((a, b) => a.odo - b.odo);
  const lastFuel = sorted[sorted.length - 1];
  const firstFuel = sorted[0];

  // ১. মোট দূরত্ব (শেষ ওডো - প্রথম ওডো)
  const totalDistance = lastFuel.odo - firstFuel.odo;

  // ২. মোট তেল (প্রথমবারের এন্ট্রি বাদে বাকি সবগুলোর যোগফল)
  // কারণ প্রথমবার তেল ভরার সময় আমরা আগের হিসাব জানি না, ১ম ওডো থেকে ২য় ওডোর দূরত্ব ২য় বারের তেলেই চলেছে।
  const totalLiters = sorted.slice(1).reduce((sum, log) => sum + log.liters, 0);

  // ৩. মোট খরচ
  const totalFuelCost = sorted.reduce((sum, log) => sum + log.totalCost, 0);

  // গড় মাইলেজ বের করা (যেকোনো এন্ট্রি হোক না কেন)
  const avgMileage = totalLiters > 0 ? totalDistance / totalLiters : 0;

  // বেস্ট এবং ওর্স্ট মাইলেজ (আগের লজিক ঠিক রাখার জন্য ইন্টারভ্যাল দিয়ে চেক করা)
  let bestMileage = 0;
  let worstMileage = Infinity;
  const mileageHistory: number[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const dist = sorted[i].odo - sorted[i - 1].odo;
    if (dist > 0 && sorted[i].liters > 0) {
      const currentMPG = dist / sorted[i].liters;
      mileageHistory.push(currentMPG);
      if (currentMPG > bestMileage) bestMileage = currentMPG;
      if (currentMPG < worstMileage) worstMileage = currentMPG;
    }
  }

  return { 
    avgMileage, 
    costPerKm: totalDistance > 0 ? totalFuelCost / totalDistance : 0, 
    totalFuelCost, 
    lastFuel, 
    validIntervals: sorted.length - 1, 
    bestMileage, 
    worstMileage: worstMileage === Infinity ? 0 : worstMileage, 
    mileageHistory 
  };
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
  const lastFuelPrice = fuelStats.lastFuel?.pricePerLiter || 0;
  
  // আপনার রিকোয়েস্ট অনুযায়ী মাইলেজের ওপর বেস করে Cost/KM
  if (fuelStats.avgMileage > 0 && lastFuelPrice > 0) {
    const currentFuelCostPerKm = lastFuelPrice / fuelStats.avgMileage;
    
    if (costType === 'FUEL') {
      displayCostPerKm = currentFuelCostPerKm;
    } else if (costType === 'FUEL_OIL') {
      const lifetimeOilCostPerKm = distanceTotal > 0 ? oilCost / distanceTotal : 0;
      displayCostPerKm = currentFuelCostPerKm + lifetimeOilCostPerKm;
    } else {
      const lifetimeMaintAndOilPerKm = distanceTotal > 0 ? (oilCost + maintCost) / distanceTotal : 0;
      displayCostPerKm = currentFuelCostPerKm + lifetimeMaintAndOilPerKm;
    }
  } else if (distanceTotal > 0) {
    // যদি মাইলেজ না পাওয়া যায় তবে লাইফটাইম গড় দেখানো হবে
    const fuelCost = fuelStats.totalFuelCost;
    if (costType === 'FUEL') displayCostPerKm = fuelCost / distanceTotal;
    else if (costType === 'FUEL_OIL') displayCostPerKm = (fuelCost + oilCost) / distanceTotal;
    else displayCostPerKm = (fuelCost + oilCost + maintCost) / distanceTotal;
  }

  // AI Station Logic
  const stationStats: Record<string, { dist: number, lit: number }> = {};
  bike.fuelLogs.forEach((log, i) => {
    if (i > 0 && log.stationName) {
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