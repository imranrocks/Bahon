import React, { useState, useEffect, useMemo } from 'react';
import { Bike, AppState, FuelLog, TankStatus, ExpenseCategory, MaintenanceLog, OilLog, CostDisplayType, Reminder, AppLanguage, AppTheme, OilGrade } from './types';
import { BikeSelector } from './components/BikeSelector';
import { DashboardCard } from './components/DashboardCard';
import { getAggregatedStats } from './utils/calculations';
import { auth, db } from './firebase'; 
import { doc, setDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { saveLocalState, getLocalState } from './utils/db';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

// Image Import
import googleIcon from './google-icon.png'; 

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
    signIn: "Sign in with Google", signOut: "Sign Out", syncActive: "Cloud Sync Active", syncOff: "Local Only",
    maintAlert: "Check Chain & Filter!"
  },
  bn: {
    appName: "বাহন", dashboard: "হোম", logs: "ইতিহাস", add: "যোগ", stats: "বিশ্লেষণ", settings: "সেটিংস",
    currentOdo: "বর্তমান ওডো", avgMileage: "গড় মাইলেজ", costPerKm: "খরচ / কিমি", thisMonth: "এই মাস",
    fuelOnly: "শুধু জ্বালানি", fuelOil: "জ্বালানি + তেল", totalCostLabel: "মোট খরচ", language: "ভাষা", theme: "থিম",
    addFuel: "জ্বালানি", addOil: "মবিল", addService: "সার্ভিস", oilBrand: "মবিলের ব্র্যান্ড", quantity: "পরিমাণ", cost: "মূল্য",
    laborCost: "মজুরি", partName: "বিবরণ", save: "সেভ", cancel: "বাতিল", notEnoughData: "ডাটা নেই।",
    reminders: "রিমাইন্ডার", smartInsights: "Bahon AI", oilMineral: "মিনারেল", oilSemi: "সেমি সিনথেটিক", oilFull: "ফুল সিনথেটিক",
    mileageDropAlert: "মাইলেজ {{p}}% কমেছে।", oilChangePrediction: "মবিল পরিবর্তন ~{{km}} কিমি পর",
    bestPump: "সেরা: {{name}}", worstPump: "খারাপ: {{name}}", devInfo: "ডেভেলপার ইনফো", builtBy: "তৈরি করেছেন",
    fbContact: "ফেসবুক", emailContact: "ইমেইল", devNote: "ফিডব্যাক?", craftedWith: "বাংলাদেশে তৈরি 🇧🇩",
    confirmDelete: "লগ মুছবেন?", mileageTrend: "মাইলেজ ট্রেন্ড", fuelVsMaint: "জ্বালানি বনাম মেইনটেন্যান্স", bestMileage: "সেরা", worstMileage: "সর্বনিম্ন",
    deleteBike: "বাইক মুছুন", deleteBikeConfirm: "সব ডাটা মুছবেন?",
    signIn: "গুগল দিয়ে লগইন", signOut: "লগ আউট", syncActive: "ক্লাউড সিঙ্ক চালু", syncOff: "অফলাইন",
    maintAlert: "চেইন এবং ফিল্টার চেক করুন!"
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
  const [isSigningIn, setIsSigningIn] = useState(false);

  const t = TRANSLATIONS[state.language as keyof typeof TRANSLATIONS];

  // ✅ FIXED Google Sign-In Handler with Firebase JS SDK authentication
  const handleSignIn = async () => {
    if (isSigningIn) return;
    
    try {
      setIsSigningIn(true);
      console.log('🚀 Starting Google Sign-In...');
      
      // Step 1: Sign in with Capacitor plugin
      const result = await FirebaseAuthentication.signInWithGoogle();
      console.log('✅ Capacitor Sign-In Success:', result);
      
      // Step 2: Get ID token from the result
      const idToken = result.credential?.idToken;
      
      if (!idToken) {
        throw new Error('No ID token received from Google Sign-In');
      }
      
      console.log('🔑 Got ID Token, authenticating with Firebase JS SDK...');
      
      // Step 3: Sign in to Firebase JS SDK with the credential
      const credential = GoogleAuthProvider.credential(idToken);
      const userCredential = await signInWithCredential(auth, credential);
      
      console.log('✅ Firebase JS SDK Sign-In Success!');
      console.log('👤 User:', userCredential.user.email);
      console.log('🎯 UID:', userCredential.user.uid);
      
      // Step 4: Update user state
      setUser(userCredential.user);
      
      console.log('✅ Authentication complete! Firestore will now work.');
      
    } catch (error: any) {
      console.error('❌ Google Sign-In Error:', error);
      console.error('Error Code:', error.code);
      console.error('Error Message:', error.message);
      
      if (error.code === '10' || error.message?.includes('10:')) {
        alert("SHA-1 সমস্যা!\n\nFirebase Console এ SHA-1 যোগ করুন এবং google-services.json আপডেট করুন।");
      } else if (error.code === 'auth/network-request-failed') {
        alert("ইন্টারনেট সংযোগ চেক করুন");
      } else if (error.code === '12501') {
        console.log('User cancelled sign-in');
      } else {
        alert(`লগইন ব্যর্থ: ${error.message}`);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  // ✅ Sign Out Handler
  const handleSignOut = async () => {
    try {
      console.log('🚪 Signing out...');
      await FirebaseAuthentication.signOut();
      await firebaseSignOut(auth);
      setUser(null);
      console.log('✅ Sign out successful');
    } catch (error: any) {
      console.error('❌ Sign out error:', error);
      setUser(null);
    }
  };

  // ✅ Load local state and listen for auth changes
  useEffect(() => {
    console.log('🔄 Initializing app...');
    
    getLocalState().then(local => { 
      if (local) {
        console.log('📦 Loaded local state');
        setState(local);
      }
    });
    
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      console.log('🔐 Auth state changed:', u ? `User: ${u.email}` : 'No user');
      
      setUser(u);
      
      if (u) {
        try {
          const docRef = doc(db, "users", u.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const cloudData = docSnap.data() as AppState;
            console.log('☁️ Loaded cloud data');
            setState(cloudData);
            await saveLocalState(cloudData);
          } else {
            console.log('📝 No cloud data found');
          }
        } catch (error) {
          console.error('❌ Error loading cloud data:', error);
        }
      }
    });
    
    return () => unsubscribe();
  }, []);

  // ✅ Save state to local and cloud with improved logging
  useEffect(() => {
    saveLocalState(state);
    
    if (user && state.bikes.length > 0) {
      const docRef = doc(db, "users", user.uid);
      
      console.log('☁️ Syncing to Firestore...');
      console.log('Auth:', auth.currentUser ? '✅ Authenticated' : '❌ Not authenticated');
      console.log('User ID:', user.uid);
      console.log('Bikes:', state.bikes.length);
      
      setDoc(docRef, state, { merge: true })
        .then(() => {
          console.log('✅ Data synced to Firestore successfully!');
          console.log('📊 Path: users/' + user.uid);
        })
        .catch(err => {
          console.error('❌ Firestore sync error:', err.code, '-', err.message);
          if (err.code === 'permission-denied') {
            console.error('⚠️ Check Firestore security rules!');
          }
        });
    }
    
    const isDark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, [state, user]);

  const activeBike = useMemo(() => state.bikes.find(b => b.id === state.activeBikeId) || null, [state.bikes, state.activeBikeId]);
  const stats = useMemo(() => activeBike ? getAggregatedStats(activeBike, state.costType) : null, [activeBike, state.costType]);
  const currencySymbol = CURRENCIES.find(c => c.code === state.currency)?.symbol || '৳';

  // --- SAVE FUNCTIONS ---
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

  // ✅ SETUP SCREEN
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
           
           {!user && (
             <button 
               type="button" 
               onClick={handleSignIn} 
               disabled={isSigningIn}
               className="w-full mb-4 bg-white dark:bg-zinc-800 border dark:border-zinc-700 py-3 rounded-2xl flex items-center justify-center gap-3 font-bold shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
             >
               <img src={googleIcon} className="w-5 h-5 object-contain" alt="Google" /> 
               {isSigningIn ? 'Loading...' : t.signIn}
             </button>
           )}
           
           {user && (
             <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl flex items-center justify-between">
               <div className="flex items-center gap-2">
                 <span className="text-sm">✅ {user.email}</span>
               </div>
               <button 
                 type="button" 
                 onClick={handleSignOut}
                 className="text-xs text-red-600 dark:text-red-400 font-bold"
               >
                 {t.signOut}
               </button>
             </div>
           )}
           
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

  // ✅ MAIN APP SCREEN
  return (
    <div className="min-h-screen pb-28 max-w-lg mx-auto bg-gray-50 dark:bg-zinc-950 font-sans transition-colors relative">
      <header className="sticky top-0 z-30 bg-gray-50/80 dark:bg-zinc-950/80 backdrop-blur-lg px-6 pt-6 pb-2 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-black text-primary-600 italic">{t.appName}</h1>
          <div className="flex items-center gap-3">
            <div className={`px-2 py-1 rounded-full text-[8px] font-black uppercase ${user ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800'}`}>
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
          <div className="grid grid-cols-2 gap-4">
            <DashboardCard title={t.currentOdo} value={stats.currentOdo.toLocaleString()} unit="KM" icon={<span>🛣️</span>} />
            <DashboardCard title={t.avgMileage} value={stats.avgMileage > 0 ? stats.avgMileage.toFixed(1) : '--'} unit="KM/L" icon={<span>⛽</span>} />
            <DashboardCard title={t.costPerKm} value={stats.costPerKmTotal.toFixed(2)} unit={currencySymbol} icon={<span>💰</span>} />
            <DashboardCard title={t.thisMonth} value={stats.monthlySpent.toFixed(0)} unit={currencySymbol} icon={<span>📅</span>} />
          </div>
        )}

        {activeTab === 'logs' && activeBike && (
  <div className="space-y-4 pb-10">
    <h2 className="text-xl font-black">{t.logs}</h2>
    {[...activeBike.fuelLogs.map(l => ({...l, type: 'FUEL'})), ...activeBike.oilLogs.map(l => ({...l, type: 'OIL'})), ...activeBike.maintenanceLogs.map(l => ({...l, type: 'MAINT'}))]
      .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .map(log => {
        const isFuel = log.type === 'FUEL';
        return (
          <div key={log.id} className="bg-white dark:bg-zinc-900 p-5 rounded-[2rem] border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden">
            {/* উপরের ছোট ট্যাগ */}
            <div className={`absolute top-0 left-0 px-4 py-1 rounded-br-2xl text-[10px] font-black uppercase ${isFuel ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
              {isFuel ? 'Fueling' : log.type}
            </div>
            
            <div className="flex justify-between items-center mt-4">
              <div className="flex flex-col">
                <span className="text-3xl font-black text-zinc-800 dark:text-zinc-100">
                  {isFuel ? (log as any).liters : (log as any).cost}
                  <small className="text-sm ml-1 font-bold text-zinc-400">{isFuel ? 'L' : currencySymbol}</small>
                </span>
                <span className="text-[11px] font-bold text-zinc-400 mt-1">at {log.odo.toLocaleString()} km on {log.date}</span>
              </div>
              
              <div className="flex flex-col items-end gap-1">
                <p className="font-black text-primary-600 text-lg">-{currencySymbol}{((log as any).totalCost || (log as any).cost || 0).toFixed(0)}</p>
                <button onClick={() => deleteLog(log.id, log.type)} className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-full hover:bg-red-50 text-xs">🗑️</button>
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
              
              {/* User Info */}
              {user ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/20">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 mb-1">Logged In</p>
                      <p className="text-sm font-bold">{user.email}</p>
                      {user.displayName && <p className="text-xs text-zinc-500">{user.displayName}</p>}
                    </div>
                    {user.photoURL && (
                      <img src={user.photoURL} alt="Profile" className="w-12 h-12 rounded-full" />
                    )}
                  </div>
                  <button 
                    onClick={handleSignOut}
                    className="w-full bg-red-500 text-white py-3 rounded-2xl font-bold text-sm"
                  >
                    {t.signOut}
                  </button>
                </div>
              ) : (
                <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Sign in to sync your data across devices</p>
                  <button 
                    onClick={handleSignIn}
                    disabled={isSigningIn}
                    className="w-full bg-white dark:bg-zinc-800 border dark:border-zinc-700 py-3 rounded-2xl flex items-center justify-center gap-3 font-bold shadow-sm disabled:opacity-50"
                  >
                    <img src={googleIcon} className="w-5 h-5 object-contain" alt="Google" /> 
                    {isSigningIn ? 'Loading...' : t.signIn}
                  </button>
                </div>
              )}
              
              <div className="bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden shadow-sm divide-y divide-zinc-100 dark:divide-zinc-800">
                 <div className="p-6 flex justify-between items-center"><span className="font-bold">{t.language}</span><div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl"><button onClick={() => setState(s => ({...s, language: 'bn'}))} className={`px-4 py-1.5 rounded-lg text-xs font-black ${state.language === 'bn' ? 'bg-primary-600 text-white' : 'text-zinc-500'}`}>বাংলা</button><button onClick={() => setState(s => ({...s, language: 'en'}))} className={`px-4 py-1.5 rounded-lg text-xs font-black ${state.language === 'en' ? 'bg-primary-600 text-white' : 'text-zinc-500'}`}>EN</button></div></div>
                 <div className="p-6 flex justify-between items-center"><span className="font-bold">{t.theme}</span><select value={state.theme} onChange={(e) => setState(s => ({...s, theme: e.target.value as AppTheme}))} className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded-xl text-xs font-black outline-none"><option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option></select></div>
                 <button onClick={deleteBike} className="w-full p-6 text-left text-red-500 font-bold">{t.deleteBike} 🗑️</button>
              </div>

              {/* Developer Info */}
              <div className="bg-primary-50 dark:bg-primary-900/10 p-6 rounded-[2.5rem] border border-primary-100 dark:border-primary-900/20">
                <h3 className="text-xs font-black uppercase tracking-widest text-primary-600 mb-4">{t.devInfo}</h3>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center text-white text-xl">🚀</div>
                  <div><p className="text-[10px] font-black uppercase text-zinc-400 mb-1">{t.builtBy}</p><p className="text-sm font-black uppercase">Imran Hossain</p></div>
                </div>
              </div>
           </div>
        )}
      </main>

      {/* Navigation */}
<nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-sm h-20 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl rounded-[2.5rem] border border-zinc-200 dark:border-white/10 shadow-2xl flex items-center justify-between px-6 z-40">
  
  {/* Home Tab */}
  <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center transition-all ${activeTab === 'dashboard' ? 'text-primary-500 scale-110' : 'text-zinc-400'}`}>
    <span className="text-2xl">🏠</span>
  </button>

  {/* History Tab (আগের মতই থাকবে) */}
  <button onClick={() => setActiveTab('logs')} className={`flex flex-col items-center transition-all ${activeTab === 'logs' ? 'text-primary-500 scale-110' : 'text-zinc-400'}`}>
    <span className="text-2xl">📋</span>
  </button>

  {/* Quick Add (+) বাটনটি এখন একদম মাঝখানে */}
  <button onClick={() => setShowAddModal('QUICK_ADD')} className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center shadow-lg text-white -translate-y-6 active:scale-90 transition-transform border-4 border-gray-50 dark:border-zinc-950">
    <span className="text-4xl">+</span>
  </button>

  {/* Summary Tab (নতুন যোগ করা হয়েছে) */}
  <button onClick={() => setActiveTab('stats')} className={`flex flex-col items-center transition-all ${activeTab === 'stats' ? 'text-primary-500 scale-110' : 'text-zinc-400'}`}>
    <span className="text-2xl">📊</span>
    <span className="text-[10px] font-bold">Summary</span>
  </button>

  {/* Settings Tab */}
  <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center transition-all ${activeTab === 'settings' ? 'text-primary-500 scale-110' : 'text-zinc-400'}`}>
    <span className="text-2xl">⚙️</span>
  </button>
       </nav>

      {/* --- ALL MODALS --- */}
      {showAddModal === 'QUICK_ADD' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-zinc-950/80 backdrop-blur-md p-6">
          <div className="w-full max-w-xs space-y-3">
            <button onClick={() => setShowAddModal(ExpenseCategory.FUEL)} className="w-full bg-white dark:bg-zinc-900 p-5 rounded-3xl flex items-center gap-4 text-lg font-black shadow-xl">⛽ {t.addFuel}</button>
            <button onClick={() => setShowAddModal(ExpenseCategory.OIL)} className="w-full bg-white dark:bg-zinc-900 p-5 rounded-3xl flex items-center gap-4 text-lg font-black shadow-xl">🛢️ {t.addOil}</button>
            <button onClick={() => setShowAddModal(ExpenseCategory.SERVICE)} className="w-full bg-white dark:bg-zinc-900 p-5 rounded-3xl flex items-center gap-4 text-lg font-black shadow-xl">🔧 {t.addService}</button>
            <button onClick={() => setShowAddModal(null)} className="w-full text-white font-bold py-4">Close</button>
          </div>
        </div>
      )}

      {/* FUEL FORM */}
      {showAddModal === ExpenseCategory.FUEL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-6 overflow-y-auto">
          <form onSubmit={handleSaveFuel} className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-[2.5rem] space-y-4">
            <h2 className="text-xl font-black uppercase text-primary-600 mb-4">⛽ {t.addFuel}</h2>
            <input required name="odo" type="number" placeholder="32800" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" defaultValue={stats?.currentOdo} />
            <div className="grid grid-cols-2 gap-4">
              <input required name="liters" type="number" step="0.01" placeholder="Liters" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <input required name="price" type="number" step="0.1" placeholder="Price/L" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            </div>
            <input name="station" placeholder="Fuel Station Name" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            <input required name="date" type="date" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
           <select name="status" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none">
  {/* ১. এটি তখন দিবেন যখন আগে ফুল করেছিলেন এবং এবারও ফুল করলেন */}
  <option value={TankStatus.FULL}>Full Tank (ফুল ট্যাংক)</option>
  
  {/* ২. এটি তখন দিবেন যখন প্রথমবার ফুল করছেন বা আগে কত ছিল জানেন না */}
  <option value={TankStatus.FULL_UNKNOWN_PREVIOUS}>Full Tank (আগে কিছু ছিলো)</option>
  
  {/* ৩. এটি তখন দিবেন যখন শুধু কিছু টাকার তেল নিয়েছেন (ট্যাংক ফুল করেননি) */}
  <option value={TankStatus.PARTIAL}>Partial (অল্প তেল)</option>
          </select>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowAddModal(null)} className="flex-1 py-4 font-black">{t.cancel}</button>
              <button type="submit" className="flex-1 bg-primary-600 text-white py-4 rounded-2xl font-black">{t.save}</button>
            </div>
          </form>
        </div>
      )}

      {/* OIL FORM */}
      {showAddModal === ExpenseCategory.OIL && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-6 overflow-y-auto">
          <form onSubmit={handleSaveOil} className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-[2.5rem] space-y-4">
            <h2 className="text-xl font-black uppercase text-primary-600 mb-4">🛢️ {t.addOil}</h2>
            <input required name="odo" type="number" placeholder="Odometer" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" defaultValue={stats?.currentOdo} />
            <input required name="brand" placeholder="Oil Brand" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            <div className="grid grid-cols-2 gap-4">
              <input required name="quantity" type="number" step="0.1" placeholder="Liters" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <input required name="cost" type="number" placeholder="Cost" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            </div>
            <select name="grade" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none">
                <option value={OilGrade.MINERAL}>{t.oilMineral}</option>
                <option value={OilGrade.SEMI_SYNTHETIC}>{t.oilSemi}</option>
                <option value={OilGrade.FULL_SYNTHETIC}>{t.oilFull}</option>
            </select>
            <input required name="date" type="date" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowAddModal(null)} className="flex-1 py-4 font-black">{t.cancel}</button>
              <button type="submit" className="flex-1 bg-primary-600 text-white py-4 rounded-2xl font-black">{t.save}</button>
            </div>
          </form>
        </div>
      )}

      {/* SERVICE / MAINTENANCE FORM */}
      {showAddModal === ExpenseCategory.SERVICE && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 p-6 overflow-y-auto">
          <form onSubmit={handleSaveMaint} className="bg-white dark:bg-zinc-900 w-full max-w-md p-8 rounded-[2.5rem] space-y-4">
            <h2 className="text-xl font-black uppercase text-primary-600 mb-4">🔧 {t.addService}</h2>
            <input required name="odo" type="number" placeholder="Odometer" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" defaultValue={stats?.currentOdo} />
            <input required name="partName" placeholder="What was serviced? (e.g. Chain, Brake)" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            <div className="grid grid-cols-2 gap-4">
              <input required name="cost" type="number" placeholder="Parts Cost" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
              <input required name="laborCost" type="number" placeholder="Labor Cost" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
            </div>
            <input required name="date" type="date" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" defaultValue={new Date().toISOString().split('T')[0]} />
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowAddModal(null)} className="flex-1 py-4 font-black">{t.cancel}</button>
              <button type="submit" className="flex-1 bg-primary-600 text-white py-4 rounded-2xl font-black">{t.save}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default App;