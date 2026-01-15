
import React, { useState, useEffect, useMemo } from 'react';
import { Bike, AppState, FuelLog, TankStatus, ExpenseCategory, MaintenanceLog, OilLog, CostDisplayType, Reminder, AppLanguage, AppTheme, OilGrade } from './types';
import { BikeSelector } from './components/BikeSelector';
import { DashboardCard } from './components/DashboardCard';
import { getAggregatedStats } from './utils/calculations';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { auth, db, googleProvider, signInWithPopup, signOut, onAuthStateChanged, doc, setDoc, getDoc, onSnapshot } from './firebase';
import { saveLocalState, getLocalState } from './utils/db';

const CURRENCIES = [{ code: 'BDT', symbol: '৳' }, { code: 'USD', symbol: '$' }, { code: 'INR', symbol: '₹' }, { code: 'EUR', symbol: '€' }];

const TRANSLATIONS = {
  en: {
    appName: "BAHON", dashboard: "Home", logs: "History", add: "Add", stats: "Insights", settings: "Settings",
    currentOdo: "Current ODO", avgMileage: "Avg Mileage", costPerKm: "Cost / KM", thisMonth: "This Month",
    fuelOnly: "Fuel only", fuelOil: "Fuel + Oil", totalCostLabel: "Total Cost", language: "Language", theme: "Theme",
    addFuel: "Fuel", addOil: "Oil", addService: "Service", oilBrand: "Oil Brand", quantity: "Qty", cost: "Price",
    laborCost: "Labor", partName: "Description", save: "Save", cancel: "Cancel", notEnoughData: "Not enough data.",
    reminders: "Reminders", smartInsights: "Bahon AI", oilMineral: "Mineral", oilSemi: "Semi Synthetic", oilFull: "Full Synthetic",
    mileageDropAlert: "Mileage dropped {{p}}%.", oilChangePrediction: "Oil change in ~{{km}} km",
    bestPump: "Best: {{name}}", worstPump: "Worst: {{name}}", devInfo: "Developer Info", builtBy: "Built By",
    fbContact: "Facebook", emailContact: "Email", devNote: "Feedback?", craftedWith: "Crafted in BD 🇧🇩",
    confirmDelete: "Delete log?", mileageTrend: "Mileage Trend", fuelVsMaint: "Fuel vs Maint", bestMileage: "Best", worstMileage: "Worst",
    deleteBike: "Delete Bike", deleteBikeConfirm: "Delete all data?",
    signIn: "Sign in with Google", signOut: "Sign Out", syncActive: "Cloud Sync Active", syncOff: "Local Only"
  },
  bn: {
    appName: "বাহন", dashboard: "হোম", logs: "ইতিহাস", add: "যোগ", stats: "বিশ্লেষণ", settings: "সেটিংস",
    currentOdo: "বর্তমান ওডো", avgMileage: "গড় মাইলেজ", costPerKm: "খরচ / কিমি", thisMonth: "এই মাস",
    fuelOnly: "শুধু জ্বালানি", fuelOil: "জ্বালানি + তেল", totalCostLabel: "মোট খরচ", language: "ভাষা", theme: "থিম",
    addFuel: "জ্বালানি", addOil: "মবিল", addService: "সার্ভিস", oilBrand: "মবিলের ব্র্যান্ড", quantity: "পরিমাণ", cost: "মূল্য",
    laborCost: "মজুরি", partName: "বিবরণ", save: "সেভ", cancel: "বাতিল", notEnoughData: "ডাটা নেই।",
    reminders: "রিমাইন্ডার", smartInsights: "Bahon AI", oilMineral: "মিনারেল", oilSemi: "সেমি সিনথেটিক", oilFull: "ফুল সিনথেটিক",
    mileageDropAlert: "মাইলেজ {{p}}% কমেছে।", oilChangePrediction: "মবিল পরিবর্তন ~{{km}} কিমি পর",
    bestPump: "সেরা: {{name}}", worstPump: "খারাপ: {{name}}", devInfo: "ডেভেলপার ইনফো", builtBy: "তৈরি করেছেন",
    fbContact: "ফেসবুক", emailContact: "ইমেইল", devNote: "ফিডব্যাক?", craftedWith: "বাংলাদেশে তৈরি 🇧🇩",
    confirmDelete: "লগ মুছবেন?", mileageTrend: "মাইলেজ ট্রেন্ড", fuelVsMaint: "জ্বালানি বনাম মেইনটেন্যান্স", bestMileage: "সেরা", worstMileage: "সর্বনিম্ন",
    deleteBike: "বুক মুছুন", deleteBikeConfirm: "সব ডাটা মুছবেন?",
    signIn: "গুগল দিয়ে লগইন", signOut: "লগ আউট", syncActive: "ক্লাউড সিঙ্ক চালু", syncOff: "অফলাইন"
  }
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    bikes: [], activeBikeId: null, darkMode: false, theme: 'system', language: 'bn', currency: 'BDT', hasSeenSetup: false, costType: 'TOTAL'
  });
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'stats' | 'settings'>('dashboard');
  const [showAddModal, setShowAddModal] = useState<ExpenseCategory | 'BIKE' | 'QUICK_ADD' | 'REMINDER' | null>(null);
  const [editingLog, setEditingLog] = useState<{id: string, cat: string} | null>(null);

  const t = TRANSLATIONS[state.language];

  // 1. Initial Load from IndexedDB
  useEffect(() => {
    getLocalState().then(local => {
      if (local) setState(local);
    });
  }, []);

  // 2. Auth Listener & Cloud Data Fetching
  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const docRef = doc(db, "users", u.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const cloudData = docSnap.data() as AppState;
          setState(cloudData);
          await saveLocalState(cloudData);
        }
      }
    });
  }, []);

  // 3. Persistent Local Saving & Background Sync to Firestore
  useEffect(() => {
    saveLocalState(state);
    if (user && state.bikes.length > 0) {
      const docRef = doc(db, "users", user.uid);
      setDoc(docRef, state, { merge: true }).catch(console.error);
    }
    const isDark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [state, user]);

  const activeBike = useMemo(() => state.bikes.find(b => b.id === state.activeBikeId) || null, [state.bikes, state.activeBikeId]);
  const stats = useMemo(() => activeBike ? getAggregatedStats(activeBike, state.costType) : null, [activeBike, state.costType]);
  const currencySymbol = CURRENCIES.find(c => c.code === state.currency)?.symbol || '৳';

  const aiInsights = useMemo(() => {
    if (!stats || !activeBike) return [];
    const insights: { text: string; icon: string; color: string }[] = [];
    if (stats.mileageHistory.length >= 3) {
      const avg = stats.avgMileage;
      const last = stats.mileageHistory[stats.mileageHistory.length - 1];
      if (last < avg * 0.85) {
        const p = Math.round((1 - last / avg) * 100);
        insights.push({ text: t.mileageDropAlert.replace('{{p}}', p.toString()), icon: '⚠️', color: 'bg-red-50 text-red-600 border-red-100' });
      }
    }
    if (activeBike.oilLogs.length > 0) {
      const lastOil = activeBike.oilLogs[activeBike.oilLogs.length - 1];
      const kmLeft = lastOil.nextChangeKm - stats.currentOdo;
      if (kmLeft < 500) insights.push({ text: t.oilChangePrediction.replace('{{km}}', Math.max(0, kmLeft).toString()), icon: '🛢️', color: 'bg-amber-50 text-amber-600 border-amber-100' });
    }
    return insights;
  }, [stats, activeBike, t]);

  const handleSignIn = () => signInWithPopup(auth, googleProvider).catch(console.error);
  const handleSignOut = () => signOut(auth).catch(console.error);

  const handleSaveFuel = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeBike) return;
    const f = new FormData(e.currentTarget);
    const lit = Number(f.get('liters')), pr = Number(f.get('price')), st = f.get('status') as TankStatus;
    const newLog: FuelLog = {
      id: editingLog?.id || Math.random().toString(36).substr(2, 9),
      date: f.get('date') as string, odo: Number(f.get('odo')),
      liters: lit, pricePerLiter: pr, totalCost: lit * pr,
      stationName: f.get('station') as string, tankStatus: st, isMileageValid: st !== TankStatus.PARTIAL
    };
    setState(prev => ({ ...prev, bikes: prev.bikes.map(b => b.id === activeBike.id ? { ...b, fuelLogs: editingLog ? b.fuelLogs.map(l => l.id === editingLog.id ? newLog : l) : [...b.fuelLogs, newLog].sort((x, y) => x.odo - y.odo) } : b) }));
    setShowAddModal(null); setEditingLog(null);
  };

  const handleSaveOil = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeBike) return;
    const f = new FormData(e.currentTarget), odo = Number(f.get('odo')), grade = f.get('grade') as OilGrade;
    const lifeMap = { [OilGrade.MINERAL]: 1000, [OilGrade.SEMI_SYNTHETIC]: 2000, [OilGrade.FULL_SYNTHETIC]: 3000 };
    const newLog: OilLog = {
      id: editingLog?.id || Math.random().toString(36).substr(2, 9), date: f.get('date') as string, odo,
      brand: f.get('brand') as string, grade, quantity: Number(f.get('quantity')), cost: Number(f.get('cost')), nextChangeKm: odo + lifeMap[grade]
    };
    setState(prev => ({ ...prev, bikes: prev.bikes.map(b => b.id === activeBike.id ? { ...b, oilLogs: editingLog ? b.oilLogs.map(l => l.id === editingLog.id ? newLog : l) : [...b.oilLogs, newLog] } : b) }));
    setShowAddModal(null); setEditingLog(null);
  };

  const handleSaveMaint = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeBike) return;
    const f = new FormData(e.currentTarget);
    const newLog: MaintenanceLog = {
      id: editingLog?.id || Math.random().toString(36).substr(2, 9), partName: f.get('partName') as string,
      category: ExpenseCategory.SERVICE, date: f.get('date') as string, odo: Number(f.get('odo')),
      cost: Number(f.get('cost')), laborCost: Number(f.get('laborCost')),
    };
    setState(prev => ({ ...prev, bikes: prev.bikes.map(b => b.id === activeBike.id ? { ...b, maintenanceLogs: editingLog ? b.maintenanceLogs.map(l => l.id === editingLog.id ? newLog : l) : [...b.maintenanceLogs, newLog] } : b) }));
    setShowAddModal(null); setEditingLog(null);
  };

  const deleteLog = (id: string, cat: string) => {
    if (!confirm(t.confirmDelete)) return;
    setState(prev => ({ ...prev, bikes: prev.bikes.map(b => b.id === activeBike?.id ? { ...b, fuelLogs: cat === 'FUEL' ? b.fuelLogs.filter(l => l.id !== id) : b.fuelLogs, oilLogs: cat === 'OIL' ? b.oilLogs.filter(l => l.id !== id) : b.oilLogs, maintenanceLogs: (cat === 'SERVICE' || cat === 'MAINT') ? b.maintenanceLogs.filter(l => l.id !== id) : b.maintenanceLogs } : b) }));
  };

  const deleteBike = () => {
    if (!state.activeBikeId) return;
    if (!confirm(t.deleteBikeConfirm)) return;
    const newBikes = state.bikes.filter(b => b.id !== state.activeBikeId);
    setState(prev => ({ ...prev, bikes: newBikes, activeBikeId: newBikes.length > 0 ? newBikes[0].id : null, hasSeenSetup: newBikes.length > 0 }));
  };

  if (!state.hasSeenSetup || showAddModal === 'BIKE') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 p-8 flex flex-col items-center justify-center max-w-lg mx-auto">
        <form onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const newBike: Bike = {
            id: Math.random().toString(36).substr(2, 9), name: f.get('name') as string, model: f.get('model') as string,
            year: Number(f.get('year')), cc: Number(f.get('cc')), initialOdo: Number(f.get('odo')),
            fuelLogs: [], oilLogs: [], maintenanceLogs: [], reminders: []
          };
          setState(s => ({ ...s, bikes: [...s.bikes, newBike], activeBikeId: newBike.id, hasSeenSetup: true }));
          setShowAddModal(null);
        }} className="w-full space-y-4 bg-white dark:bg-zinc-900 p-8 rounded-[3rem] shadow-2xl border border-zinc-100 dark:border-zinc-800">
           <h1 className="text-3xl font-black text-primary-600 italic text-center uppercase">{t.appName}</h1>
           {!user && <button type="button" onClick={handleSignIn} className="w-full mb-4 bg-white dark:bg-zinc-800 border dark:border-zinc-700 py-3 rounded-2xl flex items-center justify-center gap-3 font-bold shadow-sm"><img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/action/google.svg" className="w-5" /> {t.signIn}</button>}
           <input required name="name" placeholder="Bike Name" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
           <div className="grid grid-cols-2 gap-4">
            <input required name="model" placeholder="Model" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            <input required name="cc" type="number" placeholder="CC" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input required name="year" type="number" placeholder="Year" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            <input required name="odo" type="number" placeholder="Starting ODO" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
          </div>
          <button type="submit" className="w-full bg-primary-600 py-5 rounded-3xl text-white font-black text-lg">Setup Bike</button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto bg-gray-50 dark:bg-zinc-950 font-sans transition-colors relative">
      <header className="sticky top-0 z-30 bg-gray-50/80 dark:bg-zinc-950/80 backdrop-blur-lg px-6 pt-6 pb-2 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-primary-600 italic">{t.appName}</h1>
          <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${user ? 'bg-emerald-100 text-emerald-700' : 'bg-zinc-100 text-zinc-500'}`}>
              {user ? t.syncActive : t.syncOff}
            </div>
            <select value={state.costType} onChange={(e) => setState(s => ({...s, costType: e.target.value as CostDisplayType}))} className="text-[10px] font-black bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5 rounded-xl uppercase outline-none">
              <option value="FUEL">{t.fuelOnly}</option><option value="FUEL_OIL">{t.fuelOil}</option><option value="TOTAL">{t.totalCostLabel}</option>
            </select>
          </div>
        </div>
        <BikeSelector bikes={state.bikes} activeId={state.activeBikeId} onSelect={(id) => setState(s => ({ ...s, activeBikeId: id }))} onAdd={() => setShowAddModal('BIKE')} />
      </header>

      <main className="px-6 space-y-6">
        {activeTab === 'dashboard' && stats && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <DashboardCard title={t.currentOdo} value={stats.currentOdo.toLocaleString()} unit="KM" icon={<span>🛣️</span>} />
              <DashboardCard title={t.avgMileage} value={stats.avgMileage > 0 ? stats.avgMileage.toFixed(1) : '--'} unit="KM/L" icon={<span>⛽</span>} />
              <DashboardCard title={t.costPerKm} value={stats.costPerKmTotal.toFixed(2)} unit={currencySymbol} icon={<span>💰</span>} colorClass="text-emerald-500" />
              <DashboardCard title={t.thisMonth} value={stats.monthlySpent.toFixed(0)} unit={currencySymbol} icon={<span>📅</span>} colorClass="text-purple-500" />
            </div>
            {aiInsights.length > 0 && (
               <div className="space-y-4">
                  <h3 className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{t.smartInsights}</h3>
                  <div className="flex overflow-x-auto gap-3 no-scrollbar pb-1">
                    {aiInsights.map((ins, i) => (
                      <div key={i} className={`flex-shrink-0 w-64 p-4 rounded-3xl border ${ins.color} shadow-sm flex gap-3 items-start`}>
                        <span className="text-lg">{ins.icon}</span>
                        <p className="text-[11px] font-bold leading-relaxed">{ins.text}</p>
                      </div>
                    ))}
                  </div>
               </div>
            )}
          </>
        )}

        {activeTab === 'logs' && activeBike && (
           <div className="space-y-3">
             <h2 className="text-xl font-bold">{t.logs}</h2>
             {[...activeBike.fuelLogs.map(l => ({...l, type: 'FUEL'})), ...activeBike.oilLogs.map(l => ({...l, type: 'OIL'})), ...activeBike.maintenanceLogs.map(l => ({...l, type: 'MAINT'}))]
               .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
               .map(log => {
                  const isFuel = log.type === 'FUEL';
                  const isOil = log.type === 'OIL';
                  const isMaint = log.type === 'MAINT';
                  const displayCost = isFuel ? (log as any).totalCost : isOil ? (log as any).cost : ((log as any).cost + ((log as any).laborCost || 0));
                  const label = isFuel ? 'Fuel' : isOil ? 'Oil' : (log as any).partName;
                  
                  return (
                    <div key={log.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800 flex justify-between items-center group relative overflow-hidden transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div className="flex items-center gap-4">
                         <div className="text-center w-8">
                            <p className="text-[10px] font-black uppercase text-zinc-400 leading-none mb-1">{new Date(log.date).toLocaleDateString('en-US', {month: 'short'})}</p>
                            <p className="text-lg font-black leading-none">{new Date(log.date).getDate()}</p>
                         </div>
                         <div><p className="font-bold text-sm">{log.odo.toLocaleString()} KM - {label}</p></div>
                      </div>
                      <div className="flex items-center gap-3">
                         <p className="font-black text-primary-600">-{currencySymbol}{displayCost.toFixed(0)}</p>
                         <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingLog({id: log.id, cat: log.type}); setShowAddModal(log.type === 'FUEL' ? ExpenseCategory.FUEL : log.type === 'OIL' ? ExpenseCategory.OIL : ExpenseCategory.SERVICE); }} className="p-2 text-zinc-400 hover:text-primary-500">✏️</button>
                            <button onClick={() => deleteLog(log.id, log.type)} className="p-2 text-zinc-400 hover:text-red-500">🗑️</button>
                         </div>
                      </div>
                    </div>
                  );
               })}
           </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-6">
              <h2 className="text-xl font-bold">{t.settings}</h2>
              <div className="bg-white dark:bg-zinc-900 rounded-3xl divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden shadow-sm">
                {!user ? (
                  <button onClick={handleSignIn} className="w-full p-6 text-left flex items-center justify-between font-bold text-primary-600">
                    <span>{t.signIn}</span> <span>➜</span>
                  </button>
                ) : (
                  <div className="p-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={user.photoURL} className="w-8 h-8 rounded-full" />
                      <div><p className="text-xs font-bold leading-none">{user.displayName}</p><p className="text-[10px] text-zinc-500">{user.email}</p></div>
                    </div>
                    <button onClick={handleSignOut} className="text-xs font-black text-red-500 uppercase">{t.signOut}</button>
                  </div>
                )}
                <div className="p-6 flex justify-between items-center"><span className="font-bold">{t.language}</span><div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl"><button onClick={() => setState(s => ({...s, language: 'bn'}))} className={`px-4 py-1.5 rounded-lg text-xs font-black ${state.language === 'bn' ? 'bg-primary-600 text-white' : 'text-zinc-500'}`}>বাংলা</button><button onClick={() => setState(s => ({...s, language: 'en'}))} className={`px-4 py-1.5 rounded-lg text-xs font-black ${state.language === 'en' ? 'bg-primary-600 text-white' : 'text-zinc-500'}`}>EN</button></div></div>
                <div className="p-6 flex justify-between items-center"><span className="font-bold">{t.theme}</span><select value={state.theme} onChange={(e) => setState(s => ({...s, theme: e.target.value as AppTheme}))} className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl text-xs font-black outline-none"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div>
                <button onClick={deleteBike} className="w-full p-6 text-left text-red-500 font-bold">{t.deleteBike} 🗑️</button>
              </div>
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-xl border border-zinc-100 dark:border-zinc-800 relative overflow-hidden"><div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-400 to-primary-600 opacity-70"></div><div className="space-y-4"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center text-xl">👨‍💻</div><div><p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">{t.builtBy}</p><p className="text-xl font-black">Arizo Imran</p><p className="text-xs font-bold text-primary-600 mt-1 uppercase tracking-tight">Imran Labs</p></div></div><p className="text-[10px] text-center font-bold text-zinc-400 mt-2">{t.devNote}</p></div></div>
           </div>
        )}
      </main>

      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm h-18 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200 dark:border-white/10 shadow-2xl flex items-center justify-around px-4 z-40">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'dashboard' ? 'text-primary-500' : 'text-zinc-400'}`}><span className="text-xl">🏠</span><span className="text-[9px] font-black uppercase tracking-tighter">{t.dashboard}</span></button>
        <button onClick={() => setActiveTab('logs')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'logs' ? 'text-primary-500' : 'text-zinc-400'}`}><span className="text-xl">📋</span><span className="text-[9px] font-black uppercase tracking-tighter">{t.logs}</span></button>
        <button onClick={() => { setEditingLog(null); setShowAddModal('QUICK_ADD'); }} className="w-14 h-14 bg-primary-600 rounded-full flex flex-col items-center justify-center shadow-xl shadow-primary-500/30 text-white active:scale-90 transition-transform mb-4"><span className="text-2xl font-bold">+</span></button>
        <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'stats' ? 'text-primary-500' : 'text-zinc-400'}`}><span className="text-xl">📊</span><span className="text-[9px] font-black uppercase tracking-tighter">{t.stats}</span></button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'settings' ? 'text-primary-500' : 'text-zinc-400'}`}><span className="text-xl">⚙️</span><span className="text-[9px] font-black uppercase tracking-tighter">{t.settings}</span></button>
      </nav>

      {/* Modals remain structurally similar to previous version... */}
      {showAddModal === 'QUICK_ADD' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md p-6">
          <div className="w-full max-w-xs space-y-4">
            <button onClick={() => setShowAddModal(ExpenseCategory.FUEL)} className="w-full bg-white dark:bg-zinc-900 p-6 rounded-3xl flex items-center gap-4 text-lg font-black shadow-xl">⛽ {t.addFuel}</button>
            <button onClick={() => setShowAddModal(ExpenseCategory.OIL)} className="w-full bg-white dark:bg-zinc-900 p-6 rounded-3xl flex items-center gap-4 text-lg font-black shadow-xl">🛢️ {t.addOil}</button>
            <button onClick={() => setShowAddModal(ExpenseCategory.SERVICE)} className="w-full bg-white dark:bg-zinc-900 p-6 rounded-3xl flex items-center gap-4 text-lg font-black shadow-xl">🔧 {t.addService}</button>
            <button onClick={() => setShowAddModal(null)} className="w-full text-white font-bold py-4">Close</button>
          </div>
        </div>
      )}

      {showAddModal === ExpenseCategory.FUEL && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 backdrop-blur-md p-4">
          <form onSubmit={handleSaveFuel} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl font-black mb-6">{editingLog ? "Edit Fuel Log" : t.addFuel}</h3>
            <div className="space-y-4">
              <input required name="date" type="date" defaultValue={editingLog ? (activeBike?.fuelLogs.find(l => l.id === editingLog.id)?.date) : new Date().toISOString().split('T')[0]} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold border-none outline-none" />
              <input required name="odo" type="number" defaultValue={editingLog ? (activeBike?.fuelLogs.find(l => l.id === editingLog.id)?.odo) : ''} placeholder="ODO KM" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold border-none outline-none" />
              <div className="grid grid-cols-2 gap-4">
                <input required name="liters" type="number" step="0.01" defaultValue={editingLog ? (activeBike?.fuelLogs.find(l => l.id === editingLog.id)?.liters) : ''} placeholder="Liters" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold border-none outline-none" />
                <input required name="price" type="number" step="0.01" defaultValue={editingLog ? (activeBike?.fuelLogs.find(l => l.id === editingLog.id)?.pricePerLiter) : ''} placeholder="Price/L" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold border-none outline-none" />
              </div>
              <input name="station" defaultValue={editingLog ? (activeBike?.fuelLogs.find(l => l.id === editingLog.id)?.stationName) : ''} placeholder="Station" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <select name="status" defaultValue={editingLog ? (activeBike?.fuelLogs.find(l => l.id === editingLog.id)?.tankStatus) : TankStatus.FULL_EMPTY} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none"><option value={TankStatus.FULL_EMPTY}>⛽ Full Tank</option><option value={TankStatus.FULL_UNKNOWN}>⛽ Full (Unknown)</option><option value={TankStatus.PARTIAL}>⛽ Partial</option></select>
              <button type="submit" className="w-full bg-primary-600 py-5 rounded-3xl text-white font-black text-lg">{t.save}</button>
              <button type="button" onClick={() => { setShowAddModal(null); setEditingLog(null); }} className="w-full py-2 font-bold text-zinc-400">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showAddModal === ExpenseCategory.OIL && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 backdrop-blur-md p-4">
          <form onSubmit={handleSaveOil} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl font-black mb-6">{editingLog ? "Edit Oil" : t.addOil}</h3>
            <div className="space-y-4">
              <input required name="date" type="date" defaultValue={editingLog ? (activeBike?.oilLogs.find(l => l.id === editingLog.id)?.date) : new Date().toISOString().split('T')[0]} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <input required name="odo" type="number" defaultValue={editingLog ? (activeBike?.oilLogs.find(l => l.id === editingLog.id)?.odo) : ''} placeholder="ODO KM" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <input required name="brand" defaultValue={editingLog ? (activeBike?.oilLogs.find(l => l.id === editingLog.id)?.brand) : ''} placeholder={t.oilBrand} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <select required name="grade" defaultValue={editingLog ? (activeBike?.oilLogs.find(l => l.id === editingLog.id)?.grade) : OilGrade.MINERAL} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none"><option value={OilGrade.MINERAL}>{t.oilMineral}</option><option value={OilGrade.SEMI_SYNTHETIC}>{t.oilSemi}</option><option value={OilGrade.FULL_SYNTHETIC}>{t.oilFull}</option></select>
              <div className="grid grid-cols-2 gap-4">
                <input required name="quantity" type="number" step="0.1" defaultValue={editingLog ? (activeBike?.oilLogs.find(l => l.id === editingLog.id)?.quantity) : ''} placeholder={t.quantity} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
                <input required name="cost" type="number" defaultValue={editingLog ? (activeBike?.oilLogs.find(l => l.id === editingLog.id)?.cost) : ''} placeholder={t.cost} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              </div>
              <button type="submit" className="w-full bg-primary-600 py-5 rounded-3xl text-white font-black text-lg">{t.save}</button>
              <button type="button" onClick={() => { setShowAddModal(null); setEditingLog(null); }} className="w-full py-2 font-bold text-zinc-400">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {showAddModal === ExpenseCategory.SERVICE && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-zinc-950/70 backdrop-blur-md p-4">
          <form onSubmit={handleSaveMaint} className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-[2.5rem] p-8 animate-in slide-in-from-bottom duration-300">
            <h3 className="text-xl font-black mb-6">{editingLog ? "Edit Service" : t.addService}</h3>
            <div className="space-y-4">
              <input required name="partName" defaultValue={editingLog ? (activeBike?.maintenanceLogs.find(l => l.id === editingLog.id)?.partName) : ''} placeholder={t.partName} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <div className="grid grid-cols-2 gap-4">
                <input required name="date" type="date" defaultValue={editingLog ? (activeBike?.maintenanceLogs.find(l => l.id === editingLog.id)?.date) : new Date().toISOString().split('T')[0]} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
                <input required name="odo" type="number" defaultValue={editingLog ? (activeBike?.maintenanceLogs.find(l => l.id === editingLog.id)?.odo) : ''} placeholder="ODO KM" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input required name="cost" type="number" defaultValue={editingLog ? (activeBike?.maintenanceLogs.find(l => l.id === editingLog.id)?.cost) : ''} placeholder={t.cost} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
                <input required name="laborCost" type="number" defaultValue={editingLog ? (activeBike?.maintenanceLogs.find(l => l.id === editingLog.id)?.laborCost) : ''} placeholder={t.laborCost} className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              </div>
              <button type="submit" className="w-full bg-primary-600 py-5 rounded-3xl text-white font-black text-lg">{t.save}</button>
              <button type="button" onClick={() => { setShowAddModal(null); setEditingLog(null); }} className="w-full py-2 font-bold text-zinc-400">Cancel</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;
