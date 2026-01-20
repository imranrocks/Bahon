import React, { useState, useEffect, useMemo } from 'react';
import { Bike, AppState, FuelLog, TankStatus, ExpenseCategory, MaintenanceLog, OilLog, CostDisplayType, Reminder, AppLanguage, AppTheme, OilGrade } from './types';
import { BikeSelector } from '../components/BikeSelector';
import { DashboardCard } from '../components/DashboardCard';
import { getAggregatedStats } from './utils/calculations';
import { auth, db } from './firebase'; 
import { doc, setDoc, getDoc, collection, addDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, signOut as firebaseSignOut, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { saveLocalState, getLocalState } from './utils/db';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Lottie from "lottie-react";
import gears from "./assets/gears.json";
import success from "./assets/success.json";
import ghost from "./assets/ghost.json";
import { CURRENCIES, TRANSLATIONS } from './constants/translations';
import { usePushNotifications } from './hooks/usePushNotifications';

// Image Import
import googleIcon from "./assets/google-icon.png";



const triggerHaptic = async () => {
  try {
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (e) {
    console.log("Haptics only works on mobile");
  }
};

const App: React.FC = () => {
  // ✅ Push notification চালু করো (একদম প্রথমে)
  usePushNotifications();
  
  const [state, setState] = useState<AppState>({
    bikes: [], 
    activeBikeId: null, 
    darkMode: false, 
    theme: 'system', 
    language: 'bn', 
    currency: 'BDT', 
    hasSeenSetup: false, 
    costType: 'TOTAL'
  });
  
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'logs' | 'stats' | 'settings'>('dashboard');
  

  
const CURRENT_VERSION = 2; // এখনকার অ্যাপে এটি ১ থাকবে, পরের বার ২ করে দেবেন

const [updateInfo, setUpdateInfo] = useState<{version: number, url: string} | null>(null);

useEffect(() => {
  const checkUpdate = async () => {
    try {
      const docRef = doc(db, 'system_config', 'app_update');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        // যদি ডাটাবেসের ভার্সন (২) বর্তমান ভার্সন (১) এর চেয়ে বড় হয়
        if (data.latestVersion > CURRENT_VERSION) {
          setUpdateInfo({ version: data.latestVersion, url: data.downloadUrl });
        }
      }
    } catch (err) {
      console.error("Update check error:", err);
    }
  };
  checkUpdate();
}, []);

  const [showAddModal, setShowAddModal] = useState<ExpenseCategory | 'BIKE' | 'QUICK_ADD' | 'REMINDER' | null>(null);
  const [editingLog, setEditingLog] = useState<{id: string, cat: string} | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  


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
   
    setTimeout(() => {
  setIsInitialLoading(false);
}, 3000);

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
  const handleSaveFuel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeBike || !user) return;
    
    const f = new FormData(e.currentTarget);
    const lit = Number(f.get('liters')), pr = Number(f.get('price')), st = f.get('status') as TankStatus;
    
    const newLog: FuelLog = {
      id: editingLog?.id || Math.random().toString(36).substr(2, 9),
      date: f.get('date') as string, odo: Number(f.get('odo')),
      liters: lit, pricePerLiter: pr, totalCost: lit * pr,
      stationName: f.get('station') as string, tankStatus: st, isMileageValid: st !== TankStatus.PARTIAL
    };

    // ১. ইউজারের অ্যাপের জন্য স্টেট আপডেট
    setState(prev => ({ ...prev, bikes: prev.bikes.map(b => b.id === activeBike.id ? { ...b, fuelLogs: editingLog ? b.fuelLogs.map(l => l.id === editingLog.id ? newLog : l) : [...b.fuelLogs, newLog].sort((x, y) => x.odo - y.odo) } : b) }));

    // ২. মাস্টার রেকর্ডে মিরর কপি (অ্যাডমিনের জন্য)
    try {
      await addDoc(collection(db, "master_records"), {
  ...newLog,
  userId: user.uid,
  userEmail: user.email,
  userName: user.displayName || 'Anonymous', // ইউজারের নাম
  bikeName: activeBike.name,
  bikeModel: activeBike.model, // বাইকের মডেল
  category: 'FUEL',
  mirrorAction: editingLog ? 'UPDATE' : 'CREATE',
  createdAt: serverTimestamp()
});

    } catch (e) { console.error("Mirror failed", e); }

    triggerHaptic();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    setShowAddModal(null); setEditingLog(null);
  };

  const handleSaveOil = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeBike || !user) return;
    const f = new FormData(e.currentTarget), odo = Number(f.get('odo')), grade = f.get('grade') as OilGrade;
    const lifeMap = { [OilGrade.MINERAL]: 1000, [OilGrade.SEMI_SYNTHETIC]: 2000, [OilGrade.FULL_SYNTHETIC]: 3000 };
    const newLog: OilLog = {
      id: editingLog?.id || Math.random().toString(36).substr(2, 9), date: f.get('date') as string, odo,
      brand: f.get('brand') as string, grade, quantity: Number(f.get('quantity')), cost: Number(f.get('cost')), nextChangeKm: odo + lifeMap[grade]
    };

    // ১. স্টেট আপডেট
    setState(prev => ({ ...prev, bikes: prev.bikes.map(b => b.id === activeBike.id ? { ...b, oilLogs: editingLog ? b.oilLogs.map(l => l.id === editingLog.id ? newLog : l) : [...b.oilLogs, newLog] } : b) }));

    // ২. মিরর কপি
    try {
      await addDoc(collection(db, "master_records"), {
  ...newLog,
  userId: user.uid,
  userEmail: user.email,
  userName: user.displayName || 'Anonymous', // ইউজারের নাম
  bikeName: activeBike.name,
  bikeModel: activeBike.model, // বাইকের মডেল
  category: 'OIL',
  mirrorAction: editingLog ? 'UPDATE' : 'CREATE',
  createdAt: serverTimestamp()
});

    } catch (e) { console.error("Mirror failed", e); }
    
    triggerHaptic();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    setShowAddModal(null); setEditingLog(null);
  };

  const handleSaveMaint = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!activeBike || !user) return;
    const f = new FormData(e.currentTarget);
    const newLog: MaintenanceLog = {
      id: editingLog?.id || Math.random().toString(36).substr(2, 9), partName: f.get('partName') as string,
      category: ExpenseCategory.SERVICE, date: f.get('date') as string, odo: Number(f.get('odo')),
      cost: Number(f.get('cost')), laborCost: Number(f.get('laborCost')),
    };

    // ১. স্টেট আপডেট
    setState(prev => ({ ...prev, bikes: prev.bikes.map(b => b.id === activeBike.id ? { ...b, maintenanceLogs: editingLog ? b.maintenanceLogs.map(l => l.id === editingLog.id ? newLog : l) : [...b.maintenanceLogs, newLog] } : b) }));
    
    // ২. মিরর কপি
    try {
      await addDoc(collection(db, "master_records"), {
  ...newLog,
  userId: user.uid,
  userEmail: user.email,
  userName: user.displayName || 'Anonymous', // ইউজারের নাম
  bikeName: activeBike.name,
  bikeModel: activeBike.model, // বাইকের মডেল
  category: 'MAINTENANCE',
  mirrorAction: editingLog ? 'UPDATE' : 'CREATE',
  createdAt: serverTimestamp()
});

    } catch (e) { console.error("Mirror failed", e); }

    triggerHaptic();
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    setShowAddModal(null); setEditingLog(null);
  };

  const deleteLog = async (id: string, cat: string) => {
    if (!confirm(t.confirmDelete)) return;

    // মাস্টার রেকর্ডে ডিলিট রিপোর্ট পাঠানো
    try {
      await addDoc(collection(db, "master_records"), {
        logId: id,
        category: cat,
        userId: user?.uid,
        userEmail: user?.email,
        action: 'USER_DELETED_FROM_APP',
        deletedAt: serverTimestamp()
      });
    } catch (e) { console.log("Delete mirror failed"); }

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
           
           {/* User Info সেকশন */}
{user ? (
  <div className="bg-emerald-50 dark:bg-emerald-900/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-900/20">
    {/* ... প্রোফাইল ইনফো ... */}
    <button 
      onClick={async () => {
        await triggerHaptic(); // এখানে যোগ করলাম
        handleSignOut();
      }}
      className="w-full bg-red-500 text-white py-3 rounded-2xl font-bold text-sm"
    >
      {t.signOut}
    </button>
  </div>
) : (
  <div className="bg-zinc-50 dark:bg-zinc-900 p-6 rounded-3xl border border-zinc-100 dark:border-zinc-800">
    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">Sign in to sync your data across devices</p>
    <button 
      onClick={async () => {
        await triggerHaptic(); // এখানে যোগ করলাম
        handleSignIn();
      }}
      disabled={isSigningIn}
      className="w-full bg-white dark:bg-zinc-800 border dark:border-zinc-700 py-3 rounded-2xl flex items-center justify-center gap-3 font-bold shadow-sm disabled:opacity-50"
    >
      <img src={googleIcon} className="w-5 h-5 object-contain" alt="Google" /> 
      {isSigningIn ? 'Loading...' : t.signIn}
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
      {isInitialLoading && (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white dark:bg-zinc-950">
          <div className="w-48 h-48">
            <Lottie animationData={gears} loop={true} />
          </div>
          <p className="mt-4 text-zinc-400 font-bold animate-pulse text-sm">লোড হচ্ছে...</p>
        </div>
      )}

      {showSuccess && (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/30 dark:bg-black/30 backdrop-blur-sm pointer-events-none">
        <div className="w-64 h-64">
          <Lottie animationData={success} loop={false} />
        </div>
      </div>
    )}
    
  
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

{activeTab === 'dashboard' && activeBike && stats && (
  <div className="mt-8 px-1 pb-20 space-y-6">


    {/* ২. Bahon AI Insights Section */}
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-xl font-black italic text-zinc-800 dark:text-zinc-100 uppercase flex items-center gap-2">
          Bahon AI <span className="text-sm not-italic opacity-50">✨ Insights</span>
        </h3>
      </div>

      <div className="grid grid-cols-1 gap-4">
        
        {/* মবিল পরিবর্তনের প্রেডিকশন */}
        {activeBike.oilLogs && activeBike.oilLogs.length > 0 && (() => {
          const lastOil = [...activeBike.oilLogs].sort((a, b) => b.odo - a.odo)[0];
          const remainingKm = lastOil.nextChangeKm - (stats.currentOdo || 0);
          const isCritical = remainingKm <= 200;

          return (
            <div className={`p-5 rounded-[2rem] border transition-all ${
              isCritical ? 'bg-red-50 border-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-white border-zinc-100 dark:bg-zinc-900 dark:border-zinc-800 shadow-sm'
            }`}>
              <p className={`text-[10px] font-black uppercase ${isCritical ? 'text-red-600' : 'text-blue-600'}`}>Oil Prediction</p>
              <p className="font-black text-sm mt-1">
                {remainingKm <= 0 
                  ? `মবিল পরিবর্তনের সময় পার হয়ে গেছে! (${Math.abs(remainingKm)} KM ওভার)` 
                  : `পরবর্তী পরিবর্তন: ~${lastOil.nextChangeKm} KM (বাকি ${remainingKm} KM)`}
              </p>
            </div>
          );
        })()}

        {/* সেরা ফুয়েল পাম্প এনালাইসিস */}
        {stats.stationStats && Object.keys(stats.stationStats).length > 0 && (() => {
          const bestPump = Object.entries(stats.stationStats)
            .sort((a, b) => (b[1].dist / b[1].lit) - (a[1].dist / a[1].lit))[0][0];
          
          return (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-5 rounded-[2rem] border border-emerald-100 dark:border-emerald-900/20 shadow-sm">
              <p className="text-[10px] font-black text-emerald-600 uppercase">Station Memory</p>
              <p className="font-black text-sm mt-1 text-zinc-800 dark:text-zinc-200">
                সেরা মাইলেজ পাচ্ছেন: <span className="underline decoration-emerald-500/50">{bestPump}</span> থেকে
              </p>
            </div>
          );
        })()}

        {/* ৩. মাইলেজ ড্রপ সতর্কতা */}
        {stats.mileageHistory && stats.mileageHistory.length > 1 && (() => {
          const latestMileage = stats.mileageHistory[stats.mileageHistory.length - 1];
          const isMileageLow = latestMileage < stats.avgMileage * 0.9;
          if (!isMileageLow) return null;

          return (
            <div className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-[2rem] border border-orange-100 dark:border-orange-900/20 flex items-start gap-3 shadow-sm">
              <span className="text-xl">⚠️</span>
              <div>
                <p className="text-[10px] font-black text-orange-600 uppercase">Mileage Alert</p>
                <p className="font-black text-sm text-zinc-800 dark:text-zinc-200">
                  মাইলেজ ১০% কমেছে! টায়ার প্রেশার বা এয়ার ফিল্টার চেক করুন।
                </p>
              </div>
            </div>
          );
        })()}

        {/* ৪. মোস্ট এক্সপেন্সিভ পার্ট (নতুন AI ইনসাইট) */}
        {stats.mostExpensivePart && (
          <div className="bg-purple-50 dark:bg-purple-900/10 p-5 rounded-[2rem] border border-purple-100 dark:border-purple-900/20 shadow-sm">
            <p className="text-[10px] font-black text-purple-600 uppercase">Expense Insight</p>
            <p className="font-black text-sm mt-1 text-zinc-800 dark:text-zinc-200">
              সবচেয়ে দামি পার্টস: {stats.mostExpensivePart.partName} ({currencySymbol}{stats.mostExpensivePart.cost + stats.mostExpensivePart.laborCost})
            </p>
          </div>
        )}

        {/* কোনো ডাটা না থাকলে ডিফল্ট মেসেজ */}
        {(!activeBike.oilLogs?.length && !Object.keys(stats?.stationStats || {}).length) && (
          <div className="p-8 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] text-center text-zinc-400 font-bold text-sm">
            পর্যাপ্ত ডাটা নেই। কিছু লগ যোগ করলে AI ইনসাইট দেখাবে।
          </div>
        )}
      </div>
    </div>
  </div>
)}

         {/* Summary Tab Section */}
{activeTab === 'stats' && activeBike && stats && (
  <div className="mt-4 px-4 pb-24 space-y-6">
    <h3 className="text-xl font-black text-zinc-800 dark:text-zinc-100 uppercase italic">
      Expense Summary 📊
    </h3>

    {/* মাসিক খরচের কার্ডটি এখন এখানে */}
    <div className="bg-zinc-900 dark:bg-black text-white p-7 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
      <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
      
      <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.2em]">Monthly Overview</p>
      <h2 className="text-5xl font-black mt-2 tracking-tighter">
        <span className="text-2xl font-bold opacity-60 mr-1">{currencySymbol}</span>
        {stats.monthlySpent?.toLocaleString() || 0}
      </h2>
      
      <div className="flex flex-wrap gap-2 mt-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/5 px-4 py-2 rounded-2xl">
          <p className="text-[9px] uppercase opacity-40 font-bold">Fuel</p>
          <p className="text-xs font-black">{currencySymbol}{stats.fuelCost || 0}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md border border-white/5 px-4 py-2 rounded-2xl">
          <p className="text-[9px] uppercase opacity-40 font-bold">Oil</p>
          <p className="text-xs font-black">{currencySymbol}{stats.oilCost || 0}</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md border border-white/5 px-4 py-2 rounded-2xl">
          <p className="text-[9px] uppercase opacity-40 font-bold">Service</p>
          <p className="text-xs font-black">{currencySymbol}{stats.maintenanceCost || 0}</p>
        </div>
      </div>
    </div>

    {/* ভবিষ্যতে এখানে চার্ট বা গ্রাফ যোগ করা যাবে */}
    <div className="p-8 border-2 border-dashed border-zinc-100 dark:border-zinc-800 rounded-[2.5rem] text-center">
       <p className="text-zinc-400 font-bold text-sm">বিস্তারিত চার্ট এবং গ্রাফ শীঘ্রই আসছে...</p>
    </div>
  </div>
)}

{/* --- Dashboard Update Alert --- */}
{activeTab === 'dashboard' && updateInfo && (
  <div className="px-4 mb-4">
    <button 
      onClick={() => window.open(updateInfo.url, '_blank')}
      className="w-full bg-red-600 active:scale-95 transition-all text-white p-5 rounded-[2.5rem] font-black text-xs uppercase flex items-center justify-between shadow-xl shadow-red-500/20 group animate-bounce"
    >
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
          <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
        </span>
        <div className="text-left leading-tight">
          <p className="opacity-70 text-[9px] font-bold">New Update Available</p>
          <p className="text-sm font-black">GET VERSION v{updateInfo.version}</p>
        </div>
      </div>
      <span className="bg-white/20 px-4 py-2 rounded-2xl text-[10px]">INSTALL</span>
    </button>
  </div>
)}

        {activeTab === 'logs' && activeBike && (
  <div className="space-y-4 pb-10">
    <h2 className="text-xl font-black">{t.logs}</h2>
    
    {(activeBike.fuelLogs.length + activeBike.oilLogs.length + activeBike.maintenanceLogs.length) === 0 ? (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-48 h-48 opacity-50">
          <Lottie animationData={ghost} loop={true} />
        </div>
        <p className="text-zinc-400 font-bold mt-4 text-center">
          কোনো হিসাব পাওয়া যায়নি!<br/>
          <span className="text-[10px] font-medium">নিচের + বাটনে ক্লিক করে খরচ যোগ করুন</span>
        </p>
      </div>
    ) : (
      <div className="space-y-1">
        {[
          ...activeBike.fuelLogs.map(l => ({ ...l, type: 'FUEL' })),
          ...activeBike.oilLogs.map(l => ({ ...l, type: 'OIL' })),
          ...activeBike.maintenanceLogs.map(l => ({ ...l, type: 'MAINT' }))
        ]
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .map((log, index, sortedLogs) => {
            const isFuel = log.type === 'FUEL';

            // ১. লুক-অ্যাহেড: এই লগের পরে (ভবিষ্যতে) কোন ফুয়েল লগ আছে?
            const nextFuelLog = isFuel ? sortedLogs.slice(0, index).reverse().find(l => l.type === 'FUEL') : null;
            
            // ২. দূরত্ব: (পরের ওডো - এই ওডো)
            const distance = (isFuel && nextFuelLog && nextFuelLog.odo && log.odo) ? (nextFuelLog.odo - log.odo) : null;
            
            // ৩. মাইলেজ: আপনার অরিজিনাল ক্যালকুলেশন (পরের ওডো - এই ওডো) / পরের লগের লিটার
            // কারণ হাসান পাম্পে গিয়ে যে ওডো পেয়েছেন, সেই দূরত্ব অতিক্রম হয়েছে নীলক্ষেতের তেল দিয়ে
            const mileage = (distance && distance > 0 && nextFuelLog && (nextFuelLog as any).liters) 
              ? (distance / (nextFuelLog as any).liters).toFixed(1) 
              : null;

            return (
              <div key={log.id} className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] border border-zinc-100 dark:border-zinc-800 shadow-sm relative overflow-hidden mb-4">
                
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase ${isFuel ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                      {isFuel ? 'Fueling' : log.type}
                    </span>
                    {isFuel && (log as any).stationName && (
                      <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
                        ⛽ {(log as any).stationName}
                      </span>
                    )}
                  </div>
                  
                  <button onClick={() => {
                      triggerHaptic();
                      deleteLog(log.id, log.type);
                    }} 
                    className="p-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl hover:bg-red-50 text-xs transition-colors"
                  >
                    🗑️
                  </button>
                </div>

                <div className="flex justify-between items-end mb-4">
                  <div className="flex flex-col">
                    <span className="text-3xl font-black text-zinc-800 dark:text-zinc-100">
                      {isFuel ? (log as any).liters : (log as any).cost}
                      <small className="text-sm ml-1 font-bold text-zinc-400">{isFuel ? 'L' : currencySymbol}</small>
                    </span>
                    <span className="text-[10px] font-bold text-zinc-400 mt-1 italic">
                      at {log.odo ? log.odo.toLocaleString() : '0'} km • {log.date}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="font-black text-primary-600 text-xl">
                      -{currencySymbol}{((log as any).totalCost || (log as any).cost || 0).toFixed(0)}
                    </p>
                  </div>
                </div>

                {/* মাইলেজ বক্স এখন নীলক্ষেত লগের নিচে ৪২.৯ দেখাবে */}
                {isFuel && mileage && Number(mileage) > 0 && (
                  <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-4 border border-emerald-100 dark:border-emerald-800/30 flex justify-between items-center mt-2">
                    <div className="flex flex-col">
                      <p className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Mileage Insight</p>
                      <p className="text-[10px] font-bold text-emerald-600/60 leading-none mt-1">
                        Driven {distance} km with this fuel
                      </p>
                    </div>
                    <p className="text-xl font-black text-emerald-700 dark:text-emerald-400 leading-none">
                      {mileage} <small className="text-[10px] font-bold italic">km/L</small>
                    </p>
                  </div>
                )}
              </div>
            );
          })}
      </div>
    )}
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

     {/* Developer Info - Arizo Imran Custom Design */}
          <div className="relative mt-8 group">
            {/* গ্লো ইফেক্ট */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[2.5rem] blur-xl opacity-10 group-hover:opacity-25 transition-opacity duration-500"></div>
            
            <div className="relative bg-white dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 p-6 rounded-[2.5rem] overflow-hidden shadow-sm">
              <div className="flex flex-col gap-5">
                
                {/* টপ সেকশন: নাম এবং ল্যাব */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-zinc-800 to-black dark:from-zinc-700 dark:to-zinc-800 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg transform group-hover:-rotate-6 transition-transform duration-500">
                    🚀
                  </div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-0.5">
                      Built By Imran Labs
                    </p>
                    <h3 className="text-xl font-black text-zinc-900 dark:text-white uppercase italic tracking-tight">
                      Arizo Imran
                    </h3>
                  </div>
                </div>

                {/* ফেসবুক বাটন */}
                <button 
                  onClick={() => window.open('https://www.facebook.com/arizoimran', '_blank')}
                  className="w-full bg-[#1877F2] hover:bg-[#1877F2]/90 active:scale-95 transition-all text-white py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-3 shadow-lg shadow-blue-500/20"
                >
                  <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                  Connect on Facebook
                </button>

                {/* ভার্সন ব্যাজ */}
                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                    Production Ready • v{CURRENT_VERSION}.0
                  </p>
                </div>
              </div>
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
            <input required name="partName" placeholder="What was serviced?" className="w-full bg-zinc-50 dark:bg-zinc-800 rounded-2xl p-4 font-bold outline-none" />
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