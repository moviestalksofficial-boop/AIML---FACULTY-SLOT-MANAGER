import React, { useState, useEffect, useMemo } from 'react';
import { 
  UserPlus, 
  Calendar, 
  Users, 
  Settings, 
  Download, 
  LogOut, 
  Plus, 
  Trash2, 
  ShieldCheck,
  Search,
  School,
  Lock,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  FileDown,
  Clock,
  Filter
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  query, 
  updateDoc, 
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import {
  getAuth,
  signInWithCustomToken,
  signInAnonymously,
  onAuthStateChanged
} from 'firebase/auth';

// --- Firebase Configuration ---
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'aditya-university-slots';

// --- Constants ---
const DEPT_NAME = "Artificial Intelligence and Machine Learning";
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SLOTS = [
  '09:30 - 10:20',
  '10:20 - 11:10',
  '11:10 - 12:00',
  '01:50 - 02:40',
  '02:40 - 03:30',
  '03:30 - 04:20'
];

// Admin Credentials
const ADMIN_CREDENTIALS = {
  username: 'aiml',
  password: 'lmia'
};

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('directory'); // 'register' | 'schedule' | 'directory' | 'admin'
  const [facultyData, setFacultyData] = useState([]);
  const [currentUserProfile, setCurrentUserProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  // --- Auth & Initial Load ---
  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- Firestore Data Sync ---
  useEffect(() => {
    if (!user) return;

    const q = collection(db, 'artifacts', appId, 'public', 'data', 'faculty');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFacultyData(data);
      
      const myProfile = data.find(f => f.id === user.uid);
      if (myProfile) {
        setCurrentUserProfile(myProfile);
      } else {
        setCurrentUserProfile(null);
      }
    }, (err) => console.error("Firestore error:", err));

    return () => unsubscribe();
  }, [user]);

  // --- Actions ---
  const createEmptySchedule = () => {
    const initialSchedule = {};
    DAYS.forEach(day => {
      initialSchedule[day] = {};
      SLOTS.forEach(slot => {
        initialSchedule[day][slot] = { busy: false, work: '' };
      });
    });
    return initialSchedule;
  };

  const handleRegister = async (formData) => {
    if (!user) return;
    const newFaculty = {
      name: formData.name,
      email: formData.email,
      designation: formData.designation,
      id: user.uid,
      schedule: createEmptySchedule(),
      createdAt: new Date().toISOString()
    };

    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'faculty', user.uid), newFaculty);
    setView('schedule');
  };

  const handleBulkUpload = async (rows) => {
    if (!isAdminAuthenticated) return;
    const batch = writeBatch(db);
    
    rows.forEach(row => {
      const facultyId = crypto.randomUUID();
      const ref = doc(db, 'artifacts', appId, 'public', 'data', 'faculty', facultyId);
      batch.set(ref, {
        name: row.name,
        email: row.email,
        designation: row.designation,
        id: facultyId,
        schedule: createEmptySchedule(),
        createdAt: new Date().toISOString(),
        isBulkUploaded: true
      });
    });

    await batch.commit();
  };

  const updateSlot = async (day, slot, busy, work) => {
    if (!user || !currentUserProfile) return;
    const updatedSchedule = { ...currentUserProfile.schedule };
    updatedSchedule[day][slot] = { busy, work };
    
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'faculty', user.uid), {
      schedule: updatedSchedule
    });
  };

  const deleteFaculty = async (facultyId) => {
    if (!isAdminAuthenticated) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'faculty', facultyId));
  };

  const downloadCSV = () => {
    let csv = "Faculty Name,Designation,Day,Time Slot,Status,Activity\n";
    facultyData.forEach(fac => {
      DAYS.forEach(day => {
        SLOTS.forEach(slot => {
          const s = fac.schedule[day][slot];
          csv += `"${fac.name}","${fac.designation}","${day}","${slot}","${s.busy ? 'Busy' : 'Available'}","${s.work || '-'}"\n`;
        });
      });
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Aditya_University_Faculty_Schedules.csv`);
    a.click();
  };

  const downloadWorkloadReport = () => {
    let csv = "Faculty Name,Designation,Email,Total Busy Slots,Weekly Workload %,Activities Summary\n";
    
    facultyData.forEach(fac => {
      let busyCount = 0;
      let activities = [];
      const totalSlots = DAYS.length * SLOTS.length;

      DAYS.forEach(day => {
        SLOTS.forEach(slot => {
          if (fac.schedule[day][slot].busy) {
            busyCount++;
            if (fac.schedule[day][slot].work) {
              activities.push(`${day}: ${fac.schedule[day][slot].work}`);
            }
          }
        });
      });

      const workloadPercent = ((busyCount / totalSlots) * 100).toFixed(1);
      const activitySummary = activities.slice(0, 5).join(" | ") + (activities.length > 5 ? "..." : "");
      
      csv += `"${fac.name}","${fac.designation}","${fac.email}",${busyCount},${workloadPercent}%,"${activitySummary}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Aditya_University_Faculty_Workload_Report.csv`);
    a.click();
  };

  const downloadSampleCSV = () => {
    const csv = "name,email,designation\nJohn Doe,john@aditya.edu,Professor\nJane Smith,jane@aditya.edu,Assistant Professor";
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `faculty_upload_sample.csv`);
    a.click();
  };

  const handleAdminLogin = (u, p) => {
    if (u === ADMIN_CREDENTIALS.username && p === ADMIN_CREDENTIALS.password) {
      setIsAdminAuthenticated(true);
      setShowAdminLogin(false);
      setView('admin');
    } else {
      alert("Invalid Admin Credentials");
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <School className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 leading-tight">Aditya University</h1>
              <p className="text-sm text-slate-500 font-medium">{DEPT_NAME}</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
            <NavBtn active={view === 'directory'} onClick={() => setView('directory')} icon={<Users size={18}/>} label="Directory" />
            {currentUserProfile && (
              <NavBtn active={view === 'schedule'} onClick={() => setView('schedule')} icon={<Calendar size={18}/>} label="My Schedule" />
            )}
            {!currentUserProfile && (
              <NavBtn active={view === 'register'} onClick={() => setView('register')} icon={<UserPlus size={18}/>} label="Register" />
            )}
            <NavBtn 
              active={view === 'admin'} 
              onClick={() => isAdminAuthenticated ? setView('admin') : setShowAdminLogin(true)} 
              icon={<ShieldCheck size={18}/>} 
              label="Admin" 
            />
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'directory' && (
          <DirectoryView 
            facultyData={facultyData} 
            searchQuery={searchQuery} 
            setSearchQuery={setSearchQuery}
            onDownload={downloadCSV}
          />
        )}
        
        {view === 'register' && !currentUserProfile && (
          <RegisterView onRegister={handleRegister} />
        )}

        {view === 'schedule' && currentUserProfile && (
          <ScheduleView 
            profile={currentUserProfile} 
            onUpdate={updateSlot} 
          />
        )}

        {view === 'admin' && isAdminAuthenticated && (
          <AdminView 
            facultyData={facultyData} 
            onDelete={deleteFaculty} 
            onLogout={() => { setIsAdminAuthenticated(false); setView('directory'); }}
            onDownloadSample={downloadSampleCSV}
            onDownloadWorkload={downloadWorkloadReport}
            onBulkUpload={handleBulkUpload}
          />
        )}
      </main>

      {/* Admin Login Modal */}
      {showAdminLogin && (
        <AdminLoginModal 
          onLogin={handleAdminLogin} 
          onClose={() => setShowAdminLogin(false)} 
        />
      )}
    </div>
  );
}

function AdminLoginModal({ onLogin, onClose }) {
  const [creds, setCreds] = useState({ u: '', p: '' });
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 text-blue-600 rounded-xl mb-4">
            <Lock size={24} />
          </div>
          <h3 className="text-xl font-bold">Admin Login</h3>
          <p className="text-slate-500 text-sm mt-1">Restricted to authorized personnel</p>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onLogin(creds.u, creds.p); }} className="space-y-4">
          <input 
            type="text" 
            placeholder="Username" 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            value={creds.u}
            onChange={e => setCreds({...creds, u: e.target.value})}
          />
          <input 
            type="password" 
            placeholder="Password" 
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            value={creds.p}
            onChange={e => setCreds({...creds, p: e.target.value})}
          />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
            <button type="submit" className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100">Login</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-200 text-sm font-semibold ${
        active ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {icon} <span>{label}</span>
    </button>
  );
}

function DirectoryView({ facultyData, searchQuery, setSearchQuery, onDownload }) {
  const [showFreeOnly, setShowFreeOnly] = useState(false);
  const [filterDay, setFilterDay] = useState(DAYS[0]);
  const [filterSlot, setFilterSlot] = useState(SLOTS[0]);

  const filtered = facultyData.filter(f => {
    const matchesSearch = f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          f.designation.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (showFreeOnly) {
      const isFree = !f.schedule[filterDay][filterSlot].busy;
      return matchesSearch && isFree;
    }
    
    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Main Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Search faculty by name or designation..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={onDownload}
          className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-xl font-semibold hover:bg-slate-800 transition-colors w-full sm:w-auto justify-center"
        >
          <Download size={18} /> Export Schedules
        </button>
      </div>

      {/* Free Slot Availability Filter */}
      <div className={`bg-white p-6 rounded-2xl border shadow-sm transition-all ${showFreeOnly ? 'ring-2 ring-blue-500' : ''}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${showFreeOnly ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
              <Clock size={20} />
            </div>
            <div>
              <h4 className="font-bold text-slate-900">Check Free Availability</h4>
              <p className="text-xs text-slate-500">Find which faculty are free at a specific time</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select 
              disabled={!showFreeOnly}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
            >
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select 
              disabled={!showFreeOnly}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              value={filterSlot}
              onChange={(e) => setFilterSlot(e.target.value)}
            >
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button 
              onClick={() => setShowFreeOnly(!showFreeOnly)}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all ${
                showFreeOnly 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {showFreeOnly ? 'Clear Filter' : 'Show Free Faculty'}
            </button>
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
           <Users className="mx-auto text-slate-300 mb-4" size={48} />
           <p className="text-slate-500 font-medium">
             {showFreeOnly ? `No faculty are free on ${filterDay} during ${filterSlot}.` : 'No faculty members found.'}
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filtered.map(faculty => (
            <div key={faculty.id} className="bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col hover:border-blue-200 transition-colors">
              <div className="p-5 border-b bg-slate-50/50 flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{faculty.name}</h3>
                  <p className="text-blue-600 text-sm font-medium">{faculty.designation}</p>
                </div>
                {showFreeOnly && (
                  <div className="bg-green-50 text-green-700 px-3 py-1 rounded-full text-xs font-bold border border-green-100 flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Available Now
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-100/50">
                      <th className="px-4 py-2 font-bold border-b border-r w-32">Day</th>
                      {SLOTS.map(s => <th key={s} className="px-4 py-2 font-semibold border-b text-center text-[10px] leading-tight min-w-[80px]">{s}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map(day => (
                      <tr key={day} className={`hover:bg-slate-50 transition-colors ${showFreeOnly && day === filterDay ? 'bg-blue-50/30' : ''}`}>
                        <td className={`px-4 py-3 font-semibold border-r border-b ${showFreeOnly && day === filterDay ? 'text-blue-700' : 'bg-slate-50/30'}`}>
                          {day}
                        </td>
                        {SLOTS.map(slot => {
                          const status = faculty.schedule[day][slot];
                          const isHighlighted = showFreeOnly && day === filterDay && slot === filterSlot;
                          
                          return (
                            <td key={slot} className={`px-1 py-1 border-b ${isHighlighted ? 'bg-blue-50' : ''}`}>
                              <div className={`p-2 rounded-lg text-[10px] font-bold text-center h-full min-h-[40px] flex items-center justify-center transition-all ${
                                status.busy 
                                ? 'bg-red-50 text-red-700 border border-red-100' 
                                : isHighlighted 
                                  ? 'bg-green-100 text-green-800 border-2 border-green-500 shadow-sm scale-105' 
                                  : 'bg-green-50 text-green-700 border border-green-100'
                              }`}>
                                {status.busy ? (status.work || 'Busy') : 'Free'}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RegisterView({ onRegister }) {
  const [formData, setFormData] = useState({ name: '', email: '', designation: '' });

  return (
    <div className="max-w-md mx-auto bg-white rounded-3xl border shadow-xl p-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mb-4">
          <UserPlus size={32} />
        </div>
        <h2 className="text-2xl font-bold">Faculty Registration</h2>
        <p className="text-slate-500 mt-2">Create your profile to manage your busy hours</p>
      </div>
      
      <form onSubmit={(e) => { e.preventDefault(); onRegister(formData); }} className="space-y-5">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Full Name</label>
          <input 
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="Dr. John Doe"
            value={formData.name}
            onChange={(e) => setFormData({...formData, name: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Official Email</label>
          <input 
            required
            type="email"
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="john.doe@aditya.edu"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
          />
        </div>
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2">Designation</label>
          <select 
            required
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            value={formData.designation}
            onChange={(e) => setFormData({...formData, designation: e.target.value})}
          >
            <option value="">Select Designation</option>
            <option value="Professor & Head">Professor & Head</option>
            <option value="Professor">Professor</option>
            <option value="Associate Professor">Associate Professor</option>
            <option value="Assistant Professor">Assistant Professor</option>
            <option value="Guest Faculty">Guest Faculty</option>
          </select>
        </div>
        <button 
          type="submit"
          className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
        >
          Create Profile
        </button>
      </form>
    </div>
  );
}

function ScheduleView({ profile, onUpdate }) {
  const [editingSlot, setEditingSlot] = useState(null); 
  const [workText, setWorkText] = useState('');

  const openEditor = (day, slot, currentWork) => {
    setEditingSlot({ day, slot });
    setWorkText(currentWork || '');
  };

  const saveChange = () => {
    if (editingSlot) {
      onUpdate(editingSlot.day, editingSlot.slot, workText.trim() !== '', workText);
      setEditingSlot(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-600 text-white p-8 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold">Welcome, {profile.name}</h2>
          <p className="opacity-90 mt-2 font-medium">{profile.designation} | {DEPT_NAME}</p>
          <div className="mt-6 flex flex-wrap gap-4">
            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-sm border border-white/20">
              Click any cell to mark yourself as "Busy" with specific work.
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <Calendar size={120} />
        </div>
      </div>

      <div className="bg-white rounded-3xl border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-6 py-4 font-bold border-b border-r w-40">Day</th>
                {SLOTS.map(s => <th key={s} className="px-6 py-4 font-bold border-b text-center text-xs uppercase tracking-wider">{s}</th>)}
              </tr>
            </thead>
            <tbody>
              {DAYS.map(day => (
                <tr key={day} className="group">
                  <td className="px-6 py-5 font-bold border-r border-b bg-slate-50/50">{day}</td>
                  {SLOTS.map(slot => {
                    const status = profile.schedule[day][slot];
                    return (
                      <td 
                        key={slot} 
                        className="p-1 border-b cursor-pointer group-hover:bg-slate-50/30"
                        onClick={() => openEditor(day, slot, status.work)}
                      >
                        <div className={`p-3 rounded-2xl min-h-[60px] flex flex-col items-center justify-center text-center transition-all ${
                          status.busy 
                            ? 'bg-red-500 text-white shadow-md' 
                            : 'bg-slate-100 text-slate-400 hover:bg-slate-200 border-2 border-dashed border-slate-200'
                        }`}>
                          {status.busy ? (
                            <>
                              <span className="text-xs font-black uppercase">Busy</span>
                              <span className="text-[10px] mt-1 font-medium truncate w-full">{status.work}</span>
                            </>
                          ) : (
                            <Plus size={16} />
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editingSlot && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-sm overflow-hidden">
            <div className="p-6 border-b bg-slate-50">
              <h3 className="text-lg font-bold">{editingSlot.day}</h3>
              <p className="text-slate-500 text-sm font-medium">{editingSlot.slot}</p>
            </div>
            <div className="p-6 space-y-4">
              <label className="block text-sm font-bold text-slate-700">What is the specific work?</label>
              <textarea 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px]"
                placeholder="e.g., Lab Session, Research Meeting..."
                value={workText}
                onChange={(e) => setWorkText(e.target.value)}
              />
              <div className="flex gap-3">
                <button onClick={() => setEditingSlot(null)} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">Cancel</button>
                <button onClick={saveChange} className="flex-1 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-100">Save Status</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminView({ facultyData, onDelete, onLogout, onDownloadSample, onBulkUpload, onDownloadWorkload }) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const [headers, ...rows] = text.split('\n').map(line => line.split(',').map(cell => cell.trim()));
        
        const data = rows
          .filter(row => row.length >= 3 && row[0])
          .map(row => ({
            name: row[0],
            email: row[1],
            designation: row[2]
          }));

        if (data.length > 0) {
          onBulkUpload(data);
          alert(`Successfully initiated upload for ${data.length} faculty members.`);
        } else {
          alert("No valid data found in CSV.");
        }
      } catch (err) {
        console.error(err);
        alert("Error parsing CSV file.");
      } finally {
        setUploading(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-blue-600" size={28} />
          <h2 className="text-2xl font-bold">Admin Dashboard</h2>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={onLogout} 
            className="flex items-center gap-2 text-slate-500 font-bold hover:bg-slate-100 px-4 py-2 rounded-xl transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Bulk Actions Panel */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileSpreadsheet className="text-blue-600" size={20} />
              <h3 className="font-bold">Bulk Upload</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">Import faculty profiles using a CSV file.</p>
            
            <div className="space-y-3">
              <button 
                onClick={onDownloadSample}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 border-2 border-blue-100 text-blue-600 rounded-xl text-sm font-bold hover:bg-blue-50 transition-colors"
              >
                <Download size={16} /> Download Template
              </button>
              
              <label className={`w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 text-white rounded-xl text-sm font-bold cursor-pointer hover:bg-blue-700 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                <Upload size={16} /> {uploading ? 'Uploading...' : 'Upload Faculty CSV'}
                <input type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
              </label>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <FileDown className="text-green-600" size={20} />
              <h3 className="font-bold">Reports</h3>
            </div>
            <p className="text-sm text-slate-500 mb-6">Download consolidated data for all faculty members.</p>
            
            <button 
              onClick={onDownloadWorkload}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 transition-all shadow-lg shadow-slate-200"
            >
              <Download size={18} /> Workload Analysis (CSV)
            </button>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3">
            <AlertCircle className="text-amber-600 shrink-0" size={18} />
            <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
              Workload Analysis includes: Total Busy Hours, Weekly Load %, and Activity Summaries.
            </p>
          </div>
        </div>

        {/* List Section */}
        <div className="md:col-span-2 bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b bg-slate-50/50 flex justify-between items-center">
            <h3 className="font-bold">Managed Faculty ({facultyData.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-4 font-bold border-b text-xs uppercase tracking-wider">Faculty Name</th>
                  <th className="px-6 py-4 font-bold border-b text-xs uppercase tracking-wider">Designation</th>
                  <th className="px-6 py-4 font-bold border-b text-right text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {facultyData.map(fac => (
                  <tr key={fac.id} className="hover:bg-slate-50/50 group">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{fac.name}</div>
                      <div className="text-xs text-slate-400">{fac.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-tight">
                        {fac.designation}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => {
                          if(confirm(`Are you sure you want to delete ${fac.name}?`)) onDelete(fac.id);
                        }}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}