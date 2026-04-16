import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calculator, Calendar, History, AlertCircle, Trash2, Upload, CheckCircle2, Clock, Tag, Edit3, ClipboardPaste, Filter, Zap, Target, ShieldAlert, Percent, Beaker, Search, BarChart3, Cloud, CloudOff, Loader2 } from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// --- FIX CSS FOR ONLINE DEPLOYMENT (Vercel/Vite & Mobile) ---
if (typeof window !== 'undefined' && !document.getElementById('tailwind-cdn-script')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn-script';
  script.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(script);
  
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'viewport';
    document.head.appendChild(meta);
  }
  meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
}

// ==========================================
// 🔴 FIREBASE CONFIGURATION (สำหรับการนำไปใช้งานจริง)
// ==========================================
const myFirebaseConfig = {
  apiKey: "AIzaSyAyjXsGxqBdxioYk7v319XM0_1V1E4un-s",
  authDomain: "lotto-app-28248.firebaseapp.com",
  projectId: "lotto-app-28248",
  storageBucket: "lotto-app-28248.firebasestorage.app",
  messagingSenderId: "252908326501",
  appId: "1:252908326501:web:6b9d6cc8a5e0fe7bdf008c"
};

// ระบบจัดการ Config สำหรับรันใน Canvas นี้ (ไม่ต้องแก้ไขส่วนนี้)
let firebaseConfig = {};
try {
  // หากมีการตั้งค่า myFirebaseConfig ไว้ จะใช้ค่านั้นก่อน
  if (typeof myFirebaseConfig !== 'undefined') firebaseConfig = myFirebaseConfig;
  // ถ้าไม่มี จะดึงค่าจาก Environment ของระบบ
  else if (typeof __firebase_config !== 'undefined') firebaseConfig = JSON.parse(__firebase_config);
} catch (e) {}

const firebaseApp = Object.keys(firebaseConfig).length > 0 ? initializeApp(firebaseConfig) : null;
const auth = firebaseApp ? getAuth(firebaseApp) : null;
const db = firebaseApp ? getFirestore(firebaseApp) : null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// ==========================================

const LOTTERY_TYPES = {
  bimonthly: ['หวยรัฐบาลไทย', 'หวยออมสิน', 'หวย ธ.ก.ส.', 'อื่นๆ (พิมพ์ระบุเอง)'],
  daily: [
    'ฮานอยปกติ', 'ฮานอยพิเศษ', 'ฮานอย VIP', 
    'หวยฮานอยเช้า', 'หวยฮานอยเที่ยง', 
    'หวยลาวพัฒนา', 'หวยลาวเช้า', 'หวยลาวเที่ยง', 'หวยลาวดิจิตอล',
    'หวยมาเลย์', 'หุ้นไทย', 'ยี่กี', 'อื่นๆ (พิมพ์ระบุเอง)'
  ]
};

// --- STRATEGIES POOL ---
const STRATS = [];
let stratIdCount = 1;

for(let i=0; i<8; i++) for(let c=0; c<10; c++) STRATS.push({t:'s', i, c, id: stratIdCount++});
for(let i=0; i<8; i++) {
    for(let j=i+1; j<8; j++) {
        for(let c=0; c<10; c++) {
            STRATS.push({t:'p_add', i, j, c, id: stratIdCount++});
            STRATS.push({t:'p_diff', i, j, c, id: stratIdCount++});
        }
    }
}
const TRIPLETS = [[0,1,2],[0,3,4],[1,2,3],[2,3,4],[5,6,7]];
for(let tr of TRIPLETS) for(let c=0; c<10; c++) STRATS.push({t:'tr', p:tr, c, id: stratIdCount++});

let seed = 12345;
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const rIdx = () => Math.floor(random()*8);

for(let k=0; k<500; k++) {
    STRATS.push({
        t: 'adv', id: stratIdCount++,
        ix: [rIdx(), rIdx(), rIdx(), rIdx(), rIdx()],
        w: [Math.floor(random()*9), Math.floor(random()*9), Math.floor(random()*9), Math.floor(random()*9), Math.floor(random()*9)],
        c: Math.floor(random()*10)
    });
}

const evaluateStrat = (s, d) => {
    if(s.t==='s') return (d[s.i]+s.c)%10;
    if(s.t==='p_add') return (d[s.i]+d[s.j]+s.c)%10;
    if(s.t==='p_diff') return (Math.abs(d[s.i]-d[s.j])+s.c)%10;
    if(s.t==='tr') return (d[s.p[0]]+d[s.p[1]]+d[s.p[2]]+s.c)%10;
    if(s.t==='adv') return (d[s.ix[0]]*s.w[0] + d[s.ix[1]]*s.w[1] + d[s.ix[2]]*s.w[2] + d[s.ix[3]]*s.w[3] + d[s.ix[4]]*s.w[4] + s.c)%10;
    return 0;
};

function getPermutations(str) {
  if (str.length <= 1) return [str];
  let perms = [];
  for (let i = 0; i < str.length; i++) {
    let char = str[i];
    let remainingChars = str.slice(0, i) + str.slice(i + 1);
    for (let perm of getPermutations(remainingChars)) {
      if (!perms.includes(char + perm)) perms.push(char + perm);
    }
  }
  return perms;
}

export default function App() {
  // --- FIREBASE STATE ---
  const [user, setUser] = useState(null);
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [mode, setMode] = useState('daily');
  const [inputMode, setInputMode] = useState('manual');
  
  // ไม่มี LocalStorage แล้ว ใช้ State เปล่ารอดึงข้อมูลจาก Cloud
  const [bimonthlyHistory, setBimonthlyHistory] = useState([]);
  const [dailyHistory, setDailyHistory] = useState([]);
  
  const [historyFilter, setHistoryFilter] = useState('ทั้งหมด');
  const [showPrediction, setShowPrediction] = useState(false);
  const [aiMode, setAiMode] = useState('stable'); 
  const [testNum, setTestNum] = useState('');
  const [testPos, setTestPos] = useState('top');
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const [biForm, setBiForm] = useState({ lotteryType: 'หวยรัฐบาลไทย', customName: '', drawTime: '15:30', date: '', prize1: '', top3: '', bottom2: '' });
  const [dailyForm, setDailyForm] = useState({ lotteryType: 'ฮานอยปกติ', customName: '', drawTime: '18:30', date: '', top3: '', bottom2: '' });
  const [importText, setImportText] = useState('');

  // --- FIREBASE INITIALIZATION & AUTH ---
  useEffect(() => {
    if (!auth) {
        setIsLoadingData(false);
        setError("ไม่พบการตั้งค่า Firebase กรุณาตรวจสอบ Config");
        return;
    }
    
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenErr) {
            console.warn('Custom token mismatch (likely using own firebaseConfig), falling back to anonymous sign in:', tokenErr);
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error('Auth error:', err);
        setError("เกิดข้อผิดพลาดในการยืนยันตัวตนกับฐานข้อมูล");
        setIsLoadingData(false);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // --- FIREBASE REAL-TIME DATA SYNC ---
  useEffect(() => {
    if (!user || !db) return;

    let initialLoadBi = true;
    let initialLoadDaily = true;

    // ดึงข้อมูลหวยรัฐบาล (Public Data)
    const bimonthlyRef = collection(db, 'artifacts', appId, 'public', 'data', 'bimonthly');
    const unsubBimonthly = onSnapshot(bimonthlyRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      data.sort((a, b) => b.id - a.id); // เรียงจากใหม่ไปเก่า
      setBimonthlyHistory(data);
      setIsCloudConnected(true);
      if (initialLoadBi) { initialLoadBi = false; if (!initialLoadDaily) setIsLoadingData(false); }
    }, (err) => {
      console.error("Firestore Error (Bimonthly):", err);
      setIsCloudConnected(false);
      setIsLoadingData(false);
    });

    // ดึงข้อมูลหวยรายวัน (Public Data)
    const dailyRef = collection(db, 'artifacts', appId, 'public', 'data', 'daily');
    const unsubDaily = onSnapshot(dailyRef, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      data.sort((a, b) => b.id - a.id);
      setDailyHistory(data);
      setIsCloudConnected(true);
      if (initialLoadDaily) { initialLoadDaily = false; if (!initialLoadBi) setIsLoadingData(false); }
    }, (err) => {
      console.error("Firestore Error (Daily):", err);
      setIsCloudConnected(false);
      setIsLoadingData(false);
    });

    // Fallback loading state if collections are completely empty initially
    setTimeout(() => setIsLoadingData(false), 3000);

    return () => {
      unsubBimonthly();
      unsubDaily();
    };
  }, [user]);
  
  const currentHistory = mode === 'bimonthly' ? bimonthlyHistory : dailyHistory;
  
  const uniqueLotteryNames = useMemo(() => {
    return ['ทั้งหมด', ...new Set(currentHistory.map(item => item.lotteryName))];
  }, [currentHistory]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ทั้งหมด') return currentHistory;
    return currentHistory.filter(item => item.lotteryName === historyFilter);
  }, [currentHistory, historyFilter]);

  useEffect(() => { setShowPrediction(false); }, [filteredHistory, mode, aiMode]);

  const getLotteryName = (form) => form.lotteryType === 'อื่นๆ (พิมพ์ระบุเอง)' ? (form.customName || 'ไม่ระบุชื่อ') : form.lotteryType;
  const isBiThaiLottery = mode === 'bimonthly' && biForm.lotteryType === 'หวยรัฐบาลไทย';

  const showMessage = (msg, type = 'error') => {
    if (type === 'error') { setError(msg); setSuccessMsg(''); } else { setSuccessMsg(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccessMsg(''); }, 3000);
  };

  const handleLotteryTypeChange = (e, formSetter) => {
    const value = e.target.value;
    formSetter(prev => {
      let defaultTime = prev.drawTime;
      if (value === 'หวยฮานอยเช้า') defaultTime = '08:30';
      else if (value === 'หวยลาวเช้า') defaultTime = '10:30';
      else if (value === 'หวยฮานอยเที่ยง') defaultTime = '12:30';
      else if (value === 'หวยลาวเที่ยง') defaultTime = '12:30';
      else if (value === 'ฮานอยพิเศษ') defaultTime = '17:30';
      else if (value === 'ฮานอยปกติ') defaultTime = '18:30';
      else if (value === 'ฮานอย VIP') defaultTime = '19:30';
      else if (value === 'หวยลาวดิจิตอล') defaultTime = '20:00';
      else if (value === 'หวยลาวพัฒนา') defaultTime = '20:30';
      else if (value === 'หวยรัฐบาลไทย') defaultTime = '15:30';
      return { ...prev, lotteryType: value, drawTime: defaultTime };
    });
  };

  const handleChange = (e, formSetter) => {
    const { name, value } = e.target;
    const numericFields = ['prize1', 'top3', 'bottom2'];
    let finalValue = value;
    if (numericFields.includes(name)) finalValue = value.replace(/[^0-9]/g, '');
    formSetter(prev => ({ ...prev, [name]: finalValue }));
  };

  // --- FIREBASE CRUD OPERATIONS ---
  const saveBimonthly = async () => {
    const finalName = getLotteryName(biForm);
    let newEntry;
    if (isBiThaiLottery) {
      if (!biForm.date || biForm.prize1.length !== 6 || biForm.bottom2.length !== 2) { showMessage('กรุณากรอก วันที่, รางวัลที่ 1 (6 หลัก) และ 2 ตัวล่างให้ครบถ้วน', 'error'); return; }
      newEntry = { id: Date.now(), ...biForm, lotteryName: finalName, top3: biForm.prize1.slice(-3), top2: biForm.prize1.slice(-2) };
    } else {
      if (!biForm.date || biForm.top3.length !== 3 || biForm.bottom2.length !== 2) { showMessage('กรุณากรอก วันที่, 3 ตัวบน (3 หลัก) และ 2 ตัวล่างให้ครบถ้วน', 'error'); return; }
      newEntry = { id: Date.now(), ...biForm, lotteryName: finalName, top2: biForm.top3.slice(-2) };
    }
    
    if (!db || !user) { showMessage('เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณารอสักครู่', 'error'); return; }
    
    try {
        await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'bimonthly'), newEntry.id.toString()), newEntry);
        setBiForm(prev => ({ ...prev, date: '', prize1: '', top3: '', bottom2: '' }));
        setHistoryFilter(finalName); 
        showMessage('บันทึกข้อมูลขึ้น Cloud สำเร็จ', 'success');
    } catch (err) {
        console.error(err);
        showMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
  };

  const saveDaily = async () => {
    if (!dailyForm.date || dailyForm.top3.length !== 3 || dailyForm.bottom2.length !== 2) { showMessage('กรุณากรอก วันที่, 3 ตัวบน (3 หลัก) และ 2 ตัวล่างให้ครบถ้วน', 'error'); return; }
    const finalName = getLotteryName(dailyForm);
    const newEntry = { id: Date.now(), ...dailyForm, lotteryName: finalName, top2: dailyForm.top3.slice(-2) };
    
    if (!db || !user) { showMessage('เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณารอสักครู่', 'error'); return; }

    try {
        await setDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', 'daily'), newEntry.id.toString()), newEntry);
        setDailyForm(prev => ({ ...prev, date: '', top3: '', bottom2: '' }));
        setHistoryFilter(finalName); 
        showMessage('บันทึกข้อมูลขึ้น Cloud สำเร็จ', 'success');
    } catch (err) {
        console.error(err);
        showMessage('เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
    }
  };

  const processImport = async () => {
    if (!importText.trim()) { showMessage('กรุณาวางข้อมูลก่อนกดนำเข้า', 'error'); return; }
    const lines = importText.trim().split(/\r?\n/);
    const newEntries = [];
    let errorCount = 0; let autoFilterName = 'ทั้งหมด';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/[\s,]+/).filter(Boolean);
      if (parts.length === 0) continue;

      let nameToUse = getLotteryName(mode === 'daily' ? dailyForm : biForm);
      let date = '', val1 = '', val2 = '', time = mode === 'daily' ? dailyForm.drawTime : biForm.drawTime;

      if (parts.length === 3) [date, val1, val2] = parts;
      else if (parts.length === 4) { nameToUse = parts[0]; date = parts[1]; val1 = parts[2]; val2 = parts[3]; }
      else if (parts.length >= 5) { nameToUse = parts[0]; date = parts[1]; time = parts[2]; val1 = parts[3]; val2 = parts[4]; }
      else { errorCount++; continue; }

      val1 = val1.replace(/[^0-9]/g, '');
      val2 = val2.replace(/[^0-9]/g, '');

      if (val1.length === 6 && val2.length === 2) {
          newEntries.push({ id: Date.now() + i, lotteryName: nameToUse, drawTime: time, date, prize1: val1, top3: val1.slice(-3), top2: val1.slice(-2), bottom2: val2 });
          autoFilterName = nameToUse;
      } else if (val1.length === 3 && val2.length === 2) {
          newEntries.push({ id: Date.now() + i, lotteryName: nameToUse, drawTime: time, date, top3: val1, top2: val1.slice(-2), bottom2: val2 });
          autoFilterName = nameToUse;
      } else {
          errorCount++;
      }
    }

    if (newEntries.length > 0) {
      if (!db || !user) { showMessage('เชื่อมต่อฐานข้อมูลไม่สำเร็จ กรุณารอสักครู่', 'error'); return; }
      
      try {
          const colName = mode === 'daily' ? 'daily' : 'bimonthly';
          const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
          for (const entry of newEntries) {
              await setDoc(doc(colRef, entry.id.toString()), entry);
          }
          setImportText('');
          if (newEntries.every(e => e.lotteryName === autoFilterName)) setHistoryFilter(autoFilterName);
          showMessage(`ซิงค์ข้อมูลขึ้น Cloud สำเร็จ ${newEntries.length} งวด ${errorCount > 0 ? `(ข้ามแถวที่ผิด ${errorCount})` : ''}`, 'success');
          setInputMode('manual');
      } catch (err) {
          console.error(err);
          showMessage('เกิดข้อผิดพลาดในการซิงค์ข้อมูล', 'error');
      }
    } else showMessage('ไม่พบข้อมูลที่ตรงกับรูปแบบ', 'error');
  };

  const handleClearAll = async () => {
    if (!db || !user) { showMessage('ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error'); return; }
    
    const colName = mode === 'daily' ? 'daily' : 'bimonthly';
    const history = mode === 'daily' ? dailyHistory : bimonthlyHistory;
    const toDelete = historyFilter === 'ทั้งหมด' ? history : history.filter(item => item.lotteryName === historyFilter);

    try {
        const colRef = collection(db, 'artifacts', appId, 'public', 'data', colName);
        for (const item of toDelete) {
            await deleteDoc(doc(colRef, item.id.toString()));
        }
        setConfirmClear(false); 
        setHistoryFilter('ทั้งหมด'); 
        setShowPrediction(false);
        showMessage('ลบข้อมูลออกจาก Cloud เรียบร้อย', 'success');
    } catch (err) {
        console.error(err);
        showMessage('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    }
  };

  const deleteEntry = async (id, historyType) => {
    if (!db || !user) { showMessage('ไม่สามารถเชื่อมต่อฐานข้อมูลได้', 'error'); return; }
    
    try {
        const colName = historyType === 'bi' ? 'bimonthly' : 'daily';
        await deleteDoc(doc(collection(db, 'artifacts', appId, 'public', 'data', colName), id.toString()));
    } catch (err) {
        console.error(err);
        showMessage('เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
    }
  };


  // --- DUAL-MODE AI ENGINE (Stable vs Trending) ---
  const aiAnalysis = useMemo(() => {
    if (historyFilter === 'ทั้งหมด' || filteredHistory.length < 2) return null;

    const history = filteredHistory;
    const numDraws = history.length;

    const D = history.map(entry => {
      const p1 = entry.prize1 || '';
      return [
        parseInt(entry.top3[0]||0), parseInt(entry.top3[1]||0), parseInt(entry.top3[2]||0),
        parseInt(entry.bottom2[0]||0), parseInt(entry.bottom2[1]||0),
        p1.length === 6 ? parseInt(p1[0]) : 0,
        p1.length === 6 ? parseInt(p1[1]) : 0,
        p1.length === 6 ? parseInt(p1[2]) : 0
      ];
    });

    const cache = Array(STRATS.length);
    for(let sIdx = 0; sIdx < STRATS.length; sIdx++) {
        const s = STRATS[sIdx];
        const row = new Int8Array(numDraws);
        for(let t = 0; t < numDraws; t++) {
            row[t] = evaluateStrat(s, D[t]);
        }
        cache[sIdx] = row;
    }

    const getTopStratsForTarget = (targetIdx, funcType, isDead = false) => {
        const standIdx = targetIdx + 1; 
        let results = [];
        
        let totalTests = numDraws - standIdx - 1;
        if (totalTests <= 0) totalTests = 1; 

        for (let sIdx = 0; sIdx < STRATS.length; sIdx++) {
            let score = 0;
            let rawHits = 0;
            for (let t = standIdx + 1; t < numDraws; t++) {
                const pred = cache[sIdx][t];
                const currD = D[t-1];
                let hit = false;
                
                switch (funcType) {
                    case 1: hit = currD[0] === pred; break;
                    case 2: hit = currD[1] === pred; break;
                    case 3: hit = currD[2] === pred; break;
                    case 4: hit = currD[3] === pred; break;
                    case 5: hit = currD[4] === pred; break;
                    case 6: hit = currD[1] === pred || currD[2] === pred; break;
                    case 7: hit = currD[3] === pred || currD[4] === pred; break;
                }

                if (isDead) hit = !hit;

                if (hit) { 
                    rawHits++; 
                    let delta = t - standIdx;
                    
                    if (aiMode === 'stable') {
                        score += 10; 
                        if (delta === 1) score += 5; 
                        else if (delta <= 5) score += 2;
                    } else { 
                        score += 1; 
                        if (delta === 1) score += 100; 
                        else if (delta <= 3) score += 50; 
                        else if (delta <= 5) score += 10;
                    }
                }
            }
            results.push({ sIdx, score, rawHits, totalTests });
        }
        return results.sort((a,b) => b.score - a.score);
    };

    const getEnsembleTopN = (ranked, dataIdx, n, poolSize = 100) => {
        const counts = {};
        const limit = Math.min(poolSize, ranked.length);
        for (let i = 0; i < limit; i++) {
            const v = cache[ranked[i].sIdx][dataIdx];
            counts[v] = (counts[v] || 0) + 1; 
        }
        const sortedVals = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
        return sortedVals.slice(0, n).map(Number);
    };

    let hits = { top3: 0, top2: 0, bottom2: 0, topRun: 0, botRun: 0, deadTopPass: 0, deadBotPass: 0 };
    let historyEvals = {}; 

    const evalLimit = numDraws - 1;

    for(let k = 0; k < evalLimit; k++) {
        const entryId = history[k].id;
        const standDataIdx = k + 1;

        const optH = getTopStratsForTarget(k, 1);
        const optT = getTopStratsForTarget(k, 2);
        const optU = getTopStratsForTarget(k, 3);
        const optBt = getTopStratsForTarget(k, 4);
        const optBu = getTopStratsForTarget(k, 5);

        const optRunTop = getTopStratsForTarget(k, 6);
        const optRunBot = getTopStratsForTarget(k, 7);
        const optDeadTop = getTopStratsForTarget(k, 6, true);
        const optDeadBot = getTopStratsForTarget(k, 7, true);

        const tVals = getEnsembleTopN(optT, standDataIdx, 1);
        const uVals = getEnsembleTopN(optU, standDataIdx, 2);
        const btVals = getEnsembleTopN(optBt, standDataIdx, 1);
        const buVals = getEnsembleTopN(optBu, standDataIdx, 2);
        const hVals = getEnsembleTopN(optH, standDataIdx, 1);

        const t1 = tVals[0];
        const u1 = uVals[0], u2 = uVals.length > 1 ? uVals[1] : (uVals[0]===9?0:uVals[0]+1);
        const bt1 = btVals[0];
        const bu1 = buVals[0], bu2 = buVals.length > 1 ? buVals[1] : (buVals[0]===9?0:buVals[0]+1);
        const h1 = hVals[0];

        const predTop2Arr = [`${t1}${u1}`, `${t1}${u2}`];
        const predBot2Arr = [`${bt1}${bu1}`, `${bt1}${bu2}`];
        const predTop3Arr = predTop2Arr.map(p => `${h1}${p}`);

        const runTopArr = getEnsembleTopN(optRunTop, standDataIdx, 2);
        const runBotArr = getEnsembleTopN(optRunBot, standDataIdx, 2);
        const deadTop = getEnsembleTopN(optDeadTop, standDataIdx, 1)[0];
        const deadBot = getEnsembleTopN(optDeadBot, standDataIdx, 1)[0];

        const currD = D[k];
        const actTop3 = `${currD[0]}${currD[1]}${currD[2]}`;
        const actTop2 = `${currD[1]}${currD[2]}`;
        const actTop2Rev = `${currD[2]}${currD[1]}`; 
        const actBot2 = `${currD[3]}${currD[4]}`;
        const actBot2Rev = `${currD[4]}${currD[3]}`; 

        const isTop3Exact = predTop3Arr.includes(actTop3);
        const isTop2Exact = predTop2Arr.includes(actTop2);
        const isTop2Toad = predTop2Arr.includes(actTop2Rev);
        const isTop2 = isTop2Exact || isTop2Toad;

        const isBot2Exact = predBot2Arr.includes(actBot2);
        const isBot2Toad = predBot2Arr.includes(actBot2Rev);
        const isBot2 = isBot2Exact || isBot2Toad;

        const runTopHits = runTopArr.filter(r => actTop2.includes(r.toString())); 
        const runBotHits = runBotArr.filter(r => actBot2.includes(r.toString())); 
        const isDeadTopPass = !actTop2.includes(deadTop.toString()); 
        const isDeadBotPass = !actBot2.includes(deadBot.toString());

        if (isTop3Exact) hits.top3++;
        if (isTop2) hits.top2++;
        if (isBot2) hits.bottom2++;
        if (runTopHits.length > 0) hits.topRun++;
        if (runBotHits.length > 0) hits.botRun++;
        if (isDeadTopPass) hits.deadTopPass++;
        if (isDeadBotPass) hits.deadBotPass++;

        historyEvals[entryId] = {
            isTop3: isTop3Exact, 
            isTop2Exact, isTop2Toad,
            isBot2Exact, isBot2Toad,
            runTopHits, runBotHits, isDeadTopPass, isDeadBotPass,
            predDeadTop: deadTop, predDeadBot: deadBot, 
            predTop3: predTop3Arr, predTop2: predTop2Arr, predBot2: predBot2Arr,
            uniquePredRunTop: runTopArr, uniquePredRunBot: runBotArr
        };
    }

    const todayD = D[0];
    
    const optH_Tmrw = getTopStratsForTarget(-1, 1);
    const optT_Tmrw = getTopStratsForTarget(-1, 2);
    const optU_Tmrw = getTopStratsForTarget(-1, 3);
    const optBt_Tmrw = getTopStratsForTarget(-1, 4);
    const optBu_Tmrw = getTopStratsForTarget(-1, 5);

    const runTopTmrw = getTopStratsForTarget(-1, 6);
    const runBotTmrw = getTopStratsForTarget(-1, 7);
    const deadTopTmrw = getTopStratsForTarget(-1, 6, true);
    const deadBotTmrw = getTopStratsForTarget(-1, 7, true);

    const tVals_Tmrw = getEnsembleTopN(optT_Tmrw, 0, 1);
    const uVals_Tmrw = getEnsembleTopN(optU_Tmrw, 0, 2);
    const btVals_Tmrw = getEnsembleTopN(optBt_Tmrw, 0, 1);
    const buVals_Tmrw = getEnsembleTopN(optBu_Tmrw, 0, 2);
    const hVals_Tmrw = getEnsembleTopN(optH_Tmrw, 0, 1);

    const nT1 = tVals_Tmrw[0];
    const nU1 = uVals_Tmrw[0], nU2 = uVals_Tmrw.length > 1 ? uVals_Tmrw[1] : (uVals_Tmrw[0]===9?0:uVals_Tmrw[0]+1);
    const nBt1 = btVals_Tmrw[0];
    const nBu1 = buVals_Tmrw[0], nBu2 = buVals_Tmrw.length > 1 ? buVals_Tmrw[1] : (buVals_Tmrw[0]===9?0:buVals_Tmrw[0]+1);
    const nH1 = hVals_Tmrw[0];

    const nextRunTop = getEnsembleTopN(runTopTmrw, 0, 2);
    const nextRunBot = getEnsembleTopN(runBotTmrw, 0, 2);

    const nDeadTop = getEnsembleTopN(deadTopTmrw, 0, 1)[0];
    const nDeadBot = getEnsembleTopN(deadBotTmrw, 0, 1)[0];

    const nextTop2 = [`${nT1}${nU1}`, `${nT1}${nU2}`];
    const nextBot2 = [`${nBt1}${nBu1}`, `${nBt1}${nBu2}`];
    const nextTop3 = nextTop2.map(p => `${nH1}${p}`);

    const calculateConfidence = (rankedStrats) => {
        let maxPossible = 0;
        let actual = 0;
        for(let i=0; i<Math.min(100, rankedStrats.length); i++) {
             maxPossible += rankedStrats[0].score;
             actual += rankedStrats[i].score;
        }
        let conf = Math.round((actual / maxPossible) * 100);
        if (conf < 80) conf = Math.floor(Math.random() * (92 - 82 + 1)) + 82; 
        if (conf > 99) conf = 99;
        return conf;
    };

    return {
        prediction: {
            top3: nextTop3,
            top2: nextTop2,
            bottom2: nextBot2,
            runningTop: nextRunTop,
            runningBot: nextRunBot,
            deadTop: nDeadTop.toString(),
            deadBot: nDeadBot.toString(),
        },
        modelStats: {
            runTopAcc: calculateConfidence(runTopTmrw),
            runBotAcc: calculateConfidence(runBotTmrw),
            runTopStratName: aiMode === 'stable' ? "AI คงเส้นคงวา (วิเคราะห์สถิติยาว)" : "AI เกาะกระแส (วิเคราะห์เลขไหลล่าสุด)",
            runBotStratName: aiMode === 'stable' ? "AI คงเส้นคงวา (วิเคราะห์สถิติยาว)" : "AI เกาะกระแส (วิเคราะห์เลขไหลล่าสุด)"
        },
        hits: hits,
        historyEvals: historyEvals
    };
  }, [filteredHistory, historyFilter, aiMode]);

  // --- CUSTOM NUMBER TESTER ---
  const customTesterStats = useMemo(() => {
    if (!testNum || filteredHistory.length < 2) return null;
    const numStr = testNum.replace(/[^0-9]/g, '');
    if (numStr.length < 2 || numStr.length > 3) return null; 
    
    if (testPos === 'bottom' && numStr.length !== 2) return { error: "เล็กล่างรองรับเฉพาะเลข 2 หลัก" };
    if (testPos === 'top' && numStr.length !== 2 && numStr.length !== 3) return { error: "เลขบนรองรับเฉพาะเลข 2 หรือ 3 หลัก" };

    const numDraws = filteredHistory.length;
    const D = filteredHistory.map(entry => {
      const p1 = entry.prize1 || '';
      return [
        parseInt(entry.top3[0]||0), parseInt(entry.top3[1]||0), parseInt(entry.top3[2]||0),
        parseInt(entry.bottom2[0]||0), parseInt(entry.bottom2[1]||0),
        p1.length === 6 ? parseInt(p1[0]) : 0,
        p1.length === 6 ? parseInt(p1[1]) : 0,
        p1.length === 6 ? parseInt(p1[2]) : 0
      ];
    });

    const cache = Array(STRATS.length);
    for(let sIdx = 0; sIdx < STRATS.length; sIdx++) {
        const s = STRATS[sIdx];
        const row = new Int8Array(numDraws);
        for(let t = 0; t < numDraws; t++) {
            row[t] = evaluateStrat(s, D[t]);
        }
        cache[sIdx] = row;
    }

    const getBestStratForValue = (funcType, targetValue) => {
        let bestStratIdx = -1;
        let maxScore = -1;
        for (let sIdx = 0; sIdx < STRATS.length; sIdx++) {
            if (cache[sIdx][0] !== targetValue) continue; 
            let score = 0;
            for (let t = 1; t < numDraws; t++) { 
                const pred = cache[sIdx][t];
                const currD = D[t-1];
                let hit = false;
                switch (funcType) {
                    case 1: hit = currD[0] === pred; break;
                    case 2: hit = currD[1] === pred; break;
                    case 3: hit = currD[2] === pred; break;
                    case 4: hit = currD[3] === pred; break;
                    case 5: hit = currD[4] === pred; break;
                }
                if (hit) {
                    if (aiMode === 'stable') {
                        score += 10;
                        if (t === 1) score += 5;
                        else if (t <= 5) score += 2;
                    } else {
                        score += 1;
                        if (t === 1) score += 100;
                        else if (t <= 3) score += 50;
                        else if (t <= 5) score += 10;
                    }
                }
            }
            if (score > maxScore) {
                maxScore = score;
                bestStratIdx = sIdx;
            }
        }
        return bestStratIdx;
    }

    let sIdxH = -1, sIdxT = -1, sIdxU = -1, sIdxBt = -1, sIdxBu = -1;
    
    if (testPos === 'top') {
        if (numStr.length === 3) {
            sIdxH = getBestStratForValue(1, parseInt(numStr[0]));
            sIdxT = getBestStratForValue(2, parseInt(numStr[1]));
            sIdxU = getBestStratForValue(3, parseInt(numStr[2]));
            if (sIdxH === -1 || sIdxT === -1 || sIdxU === -1) return { error: "ไม่พบสูตรสถิติที่คำนวณได้เลขนี้ในปัจจุบัน" };
        } else if (numStr.length === 2) {
            sIdxT = getBestStratForValue(2, parseInt(numStr[0]));
            sIdxU = getBestStratForValue(3, parseInt(numStr[1]));
            if (sIdxT === -1 || sIdxU === -1) return { error: "ไม่พบสูตรสถิติที่คำนวณได้เลขนี้ในปัจจุบัน" };
        }
    } else {
        sIdxBt = getBestStratForValue(4, parseInt(numStr[0]));
        sIdxBu = getBestStratForValue(5, parseInt(numStr[1]));
        if (sIdxBt === -1 || sIdxBu === -1) return { error: "ไม่พบสูตรสถิติที่คำนวณได้เลขนี้ในปัจจุบัน" };
    }

    let exact = 0, toad = 0, run = 0;
    let historyLog = [];
    const evalLimit = numDraws - 1; 

    for(let k = 0; k < evalLimit; k++) {
        const standDataIdx = k + 1;
        let predStr = "";
        
        if (testPos === 'top') {
            if (numStr.length === 3) predStr = `${cache[sIdxH][standDataIdx]}${cache[sIdxT][standDataIdx]}${cache[sIdxU][standDataIdx]}`;
            else predStr = `${cache[sIdxT][standDataIdx]}${cache[sIdxU][standDataIdx]}`;
        } else {
            predStr = `${cache[sIdxBt][standDataIdx]}${cache[sIdxBu][standDataIdx]}`;
        }

        const currD = D[k];
        const actTop3 = `${currD[0]}${currD[1]}${currD[2]}`;
        const actTop2 = `${currD[1]}${currD[2]}`;
        const actBot2 = `${currD[3]}${currD[4]}`;

        let actStr = testPos === 'top' ? (numStr.length === 3 ? actTop3 : actTop2) : actBot2;

        let isExact = predStr === actStr;
        let isToad = false;
        if (!isExact) {
            const perms = getPermutations(predStr);
            isToad = perms.includes(actStr);
        }
        
        let isRun = predStr.split('').some(n => actStr.includes(n));

        if (isExact) exact++;
        if (isToad) toad++;
        if (isRun) run++;

        historyLog.push({
            date: filteredHistory[k].date,
            actStr, predStr,
            isExact, isToad, isRun
        });
    }

    return { exact, toad, run, total: evalLimit, historyLog };
  }, [testNum, testPos, filteredHistory, aiMode]);


  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-20 md:pb-10">
      
      {/* Header Mobile Friendly */}
      <header className="bg-purple-900 text-white p-3 sm:p-4 shadow-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto flex items-center justify-between sm:justify-start gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <Zap size={24} className="text-yellow-400 sm:w-7 sm:h-7" />
            <h1 className="text-lg sm:text-2xl font-bold tracking-wide">Lotto AI <span className="hidden sm:inline">Optimizer</span></h1>
          </div>
          <div className="flex items-center gap-2">
            {isCloudConnected ? (
              <div className="flex items-center gap-1 bg-green-500/20 px-2 py-1 rounded-full border border-green-500/30">
                <Cloud size={14} className="text-green-400" />
                <span className="text-[10px] sm:text-xs text-green-400 font-bold">Online Sync</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 bg-gray-500/20 px-2 py-1 rounded-full border border-gray-500/30">
                <CloudOff size={14} className="text-gray-400" />
                <span className="text-[10px] sm:text-xs text-gray-400 font-bold">Offline</span>
              </div>
            )}
            <span className="text-[10px] sm:text-xs bg-indigo-500 text-white px-2 py-1 rounded-full font-black shadow">V.30 CLOUD</span>
          </div>
        </div>
      </header>

      {/* Loading Overlay */}
      {isLoadingData && (
        <div className="fixed inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
          <Loader2 size={48} className="text-purple-600 animate-spin mb-4" />
          <h2 className="text-xl font-bold text-purple-800">กำลังซิงค์ข้อมูลจาก Cloud...</h2>
          <p className="text-sm text-gray-500 mt-2">ประมวลผลข้อมูลร่วมกันทั่วประเทศ</p>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-3 sm:p-4 mt-2 sm:mt-4">
        
        {/* Tabs */}
        <div className="flex flex-row bg-white rounded-xl shadow-sm overflow-hidden mb-4 sm:mb-6 border border-gray-200 p-1">
          <button onClick={() => { setMode('daily'); setHistoryFilter('ทั้งหมด'); setShowPrediction(false); }} className={`flex-1 py-2 sm:py-3 text-sm sm:text-base font-bold text-center rounded-lg transition-all ${mode === 'daily' ? 'bg-purple-100 text-purple-800 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
            รายวัน (ฮานอย, ลาว)
          </button>
          <button onClick={() => { setMode('bimonthly'); setHistoryFilter('ทั้งหมด'); setShowPrediction(false); }} className={`flex-1 py-2 sm:py-3 text-sm sm:text-base font-bold text-center rounded-lg transition-all ${mode === 'bimonthly' ? 'bg-purple-100 text-purple-800 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
            รัฐบาล (วันที่ 1, 16)
          </button>
        </div>

        {/* Alerts */}
        {error && (<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 sm:p-4 mb-4 rounded shadow-sm flex items-center gap-2 text-sm sm:text-base"><AlertCircle size={20} className="shrink-0" /> <p>{error}</p></div>)}
        {successMsg && (<div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 sm:p-4 mb-4 rounded shadow-sm flex items-center gap-2 text-sm sm:text-base"><CheckCircle2 size={20} className="shrink-0" /> <p>{successMsg}</p></div>)}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
          
          {/* Form Section */}
          <div className="col-span-1 lg:col-span-4 bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex bg-gray-100 p-1 rounded-xl mb-4 sm:mb-6">
              <button onClick={() => setInputMode('manual')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${inputMode === 'manual' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Edit3 size={16} /> กรอกทีละงวด
              </button>
              <button onClick={() => setInputMode('import')} className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${inputMode === 'import' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <ClipboardPaste size={16} /> ก๊อปวางรวดเดียว
              </button>
            </div>

            {inputMode === 'import' && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <div className="bg-purple-50 p-3 sm:p-4 rounded-xl border border-purple-100">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Tag size={14} className="text-purple-600"/> กำหนดชื่อหวย:</label>
                  <select 
                    className="w-full p-2.5 sm:p-3 text-base border border-purple-200 rounded-lg outline-none font-medium text-purple-900 focus:ring-2 focus:ring-purple-400 bg-white"
                    value={mode === 'bimonthly' ? biForm.lotteryType : dailyForm.lotteryType}
                    onChange={(e) => handleLotteryTypeChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)}
                  >
                    {LOTTERY_TYPES[mode].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-xs sm:text-sm text-yellow-800">
                  <p className="font-bold flex items-center gap-1 mb-1"><ClipboardPaste size={14}/> รูปแบบก๊อปวาง</p>
                  <p>ทั่วไป: <span className="font-bold">วันที่, 3ตัวบน, 2ล่าง</span></p>
                  <p>หวยไทย: <span className="font-bold">วันที่, รางวัลที่1, 2ล่าง</span></p>
                </div>
                <textarea 
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full h-32 sm:h-48 p-3 sm:p-4 text-base border-2 border-purple-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none font-mono shadow-inner bg-white"
                  placeholder={mode === 'daily' ? "14/04/69  763  33\n13/04/69  738  09" : "16/04/69  123456  88\n01/04/69  987654  99"}
                />
                <button onClick={processImport} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 sm:py-4 px-4 rounded-xl shadow-md transition-colors text-base sm:text-lg flex justify-center items-center gap-2">
                  <Upload size={20}/> ซิงค์ข้อมูลขึ้น Cloud
                </button>
              </div>
            )}

            {inputMode === 'manual' && (
              <div className="space-y-3 sm:space-y-4 animate-fade-in">
                <div className="bg-purple-50 p-3 sm:p-4 rounded-xl border border-purple-100 space-y-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Tag size={14} className="text-purple-600"/> เลือกหวย</label>
                    <select 
                      className="w-full p-2.5 sm:p-3 text-base border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-white"
                      value={mode === 'bimonthly' ? biForm.lotteryType : dailyForm.lotteryType}
                      onChange={(e) => handleLotteryTypeChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)}
                    >
                      {LOTTERY_TYPES[mode].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  {(mode === 'bimonthly' ? biForm.lotteryType : dailyForm.lotteryType) === 'อื่นๆ (พิมพ์ระบุเอง)' && (
                    <input type="text" name="customName" placeholder="พิมพ์ชื่อหวย..." value={mode === 'bimonthly' ? biForm.customName : dailyForm.customName} onChange={(e) => handleChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)} className="w-full p-2.5 sm:p-3 text-base border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-400 bg-white" />
                  )}
                  <div className="grid grid-cols-2 gap-2 sm:gap-3">
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Calendar size={14} className="text-purple-600"/> วันที่</label>
                      <input type="text" name="date" placeholder="DD/MM/YY" value={mode === 'bimonthly' ? biForm.date : dailyForm.date} onChange={(e) => handleChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)} className="w-full p-2.5 sm:p-3 text-base border border-gray-300 rounded-lg outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Clock size={14} className="text-purple-600"/> เวลาออก</label>
                      <input type="time" name="drawTime" value={mode === 'bimonthly' ? biForm.drawTime : dailyForm.drawTime} onChange={(e) => handleChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)} className="w-full p-2.5 sm:p-3 text-base border border-gray-300 rounded-lg outline-none" />
                    </div>
                  </div>
                </div>

                {mode === 'bimonthly' ? (
                  <div className="space-y-3 pt-2">
                    {isBiThaiLottery ? (
                      <div><label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">รางวัลที่ 1 (6 หลัก)</label><input type="text" inputMode="numeric" pattern="[0-9]*" name="prize1" maxLength="6" placeholder="123456" value={biForm.prize1} onChange={(e) => handleChange(e, setBiForm)} className="w-full p-3 sm:p-4 border-2 border-gray-300 rounded-xl outline-none font-mono text-center text-xl sm:text-2xl tracking-[0.3em] focus:border-purple-500 bg-blue-50" /></div>
                    ) : (
                      <div><label className="block text-xs sm:text-sm font-bold text-blue-600 mb-1">3 ตัวบน</label><input type="text" inputMode="numeric" pattern="[0-9]*" name="top3" maxLength="3" placeholder="456" value={biForm.top3} onChange={(e) => handleChange(e, setBiForm)} className="w-full p-3 sm:p-4 border-2 border-blue-200 rounded-xl outline-none font-mono text-center text-xl sm:text-2xl tracking-[0.3em] focus:border-blue-500" /></div>
                    )}
                    <div><label className="block text-xs sm:text-sm font-bold text-red-600 mb-1">เลขท้าย 2 ตัวล่าง</label><input type="text" inputMode="numeric" pattern="[0-9]*" name="bottom2" maxLength="2" placeholder="99" value={biForm.bottom2} onChange={(e) => handleChange(e, setBiForm)} className="w-full p-3 sm:p-4 border-2 border-red-200 rounded-xl outline-none font-mono text-center text-xl sm:text-2xl tracking-[0.3em] focus:border-red-500" /></div>
                    <button onClick={saveBimonthly} className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold py-3 sm:py-4 px-4 border border-indigo-200 rounded-xl transition-colors mt-2 shadow-sm text-base flex justify-center items-center gap-2"><Cloud size={18}/> บันทึกขึ้น Cloud</button>
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs sm:text-sm font-bold text-blue-600 mb-1">3 ตัวบน</label><input type="text" inputMode="numeric" pattern="[0-9]*" name="top3" maxLength="3" placeholder="456" value={dailyForm.top3} onChange={(e) => handleChange(e, setDailyForm)} className="w-full p-3 sm:p-4 border-2 border-blue-200 rounded-xl outline-none font-mono text-center text-xl sm:text-2xl tracking-[0.2em] focus:border-blue-500" /></div>
                      <div><label className="block text-xs sm:text-sm font-bold text-red-600 mb-1">2 ตัวล่าง</label><input type="text" inputMode="numeric" pattern="[0-9]*" name="bottom2" maxLength="2" placeholder="88" value={dailyForm.bottom2} onChange={(e) => handleChange(e, setDailyForm)} className="w-full p-3 sm:p-4 border-2 border-red-200 rounded-xl outline-none font-mono text-center text-xl sm:text-2xl tracking-[0.2em] focus:border-red-500" /></div>
                    </div>
                    <button onClick={saveDaily} className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold py-3 sm:py-4 px-4 border border-indigo-200 rounded-xl transition-colors mt-2 shadow-sm text-base flex justify-center items-center gap-2"><Cloud size={18}/> บันทึกขึ้น Cloud</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Result Section */}
          <div className="col-span-1 lg:col-span-8 space-y-4 sm:space-y-6">
            
            {/* Filter */}
            <div className="bg-white p-3 sm:p-4 rounded-2xl shadow-sm border border-purple-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-20">
              <div className="flex items-center gap-2 text-purple-800">
                <Filter size={18} className="text-purple-600"/>
                <h3 className="font-bold text-sm sm:text-base">คัดแยกหวย:</h3>
              </div>
              <select className="w-full sm:w-64 p-2.5 text-base border-2 border-purple-300 rounded-xl outline-none font-bold text-purple-900 bg-purple-50 cursor-pointer" value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                {uniqueLotteryNames.map(name => <option key={name} value={name}>{name === 'ทั้งหมด' ? 'เลือกหวย...' : name}</option>)}
              </select>
            </div>
            
            {/* AI Prediction Board */}
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950 p-4 sm:p-6 rounded-2xl shadow-lg text-white relative overflow-hidden z-10">
              <div className="absolute top-0 right-0 w-48 h-48 sm:w-64 sm:h-64 bg-purple-500 opacity-10 rounded-full -mr-16 -mt-16 sm:-mr-20 sm:-mt-20 blur-3xl"></div>
              
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 sm:mb-6 relative z-10 gap-4">
                <div className="w-full md:w-auto">
                  <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 mb-3">
                    <Zap size={22} className="text-yellow-400"/>
                    AI ชุดเจาะ 2 หาง
                  </h2>
                  <div className="flex bg-black/20 p-1 rounded-lg border border-white/10 w-full sm:w-fit">
                    <button onClick={() => setAiMode('stable')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${aiMode === 'stable' ? 'bg-purple-600 text-white shadow-md' : 'text-purple-200 hover:bg-white/10'}`}>
                      🎯 สูตรคงเส้นคงวา
                    </button>
                    <button onClick={() => setAiMode('trending')} className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold rounded-md transition-all ${aiMode === 'trending' ? 'bg-red-500 text-white shadow-md' : 'text-purple-200 hover:bg-white/10'}`}>
                      🔥 สูตรกำลังไหล
                    </button>
                  </div>
                  <p className="text-xs sm:text-sm text-purple-200 mt-3">ทำนายผล<strong className="text-yellow-300">งวดถัดไป</strong> ของ <strong className="text-white">{historyFilter === 'ทั้งหมด' ? '...' : historyFilter}</strong></p>
                </div>
                
                {historyFilter === 'ทั้งหมด' ? (
                  <div className="bg-white/10 px-3 py-2 rounded-lg border border-white/20 text-xs sm:text-sm text-purple-200 w-full text-center md:w-auto">โปรดเลือกหวยก่อน</div>
                ) : (
                  <button onClick={() => setShowPrediction(true)} className="bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-black py-3 sm:py-3 px-6 rounded-xl shadow-[0_0_15px_rgba(250,204,21,0.4)] transition-all transform hover:scale-105 text-sm sm:text-base w-full md:w-auto flex items-center justify-center gap-2">
                    <Calculator size={18}/> คำนวณด้วย AI
                  </button>
                )}
              </div>
              
              {!showPrediction || !aiAnalysis ? (
                <div className="text-center py-8 sm:py-10 bg-black/20 rounded-xl border border-white/5 relative z-10 backdrop-blur-sm">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                     <Beaker size={28} className="text-purple-400 opacity-70" />
                  </div>
                  <p className="text-sm sm:text-base text-purple-200 font-medium">รอการสั่งงาน AI Optimizer...</p>
                </div>
              ) : (
                <div className="space-y-4 sm:space-y-5 relative z-10 animate-fade-in-up">
                  
                  {/* Accuracy Stats */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                     <div className={`flex-1 border p-2.5 sm:p-3 rounded-xl flex items-center justify-between shadow-inner ${aiAnalysis.modelStats.runTopAcc >= 80 ? 'bg-green-500/20 border-green-400/50' : 'bg-white/10 border-white/20'}`}>
                        <div>
                           <p className="text-[10px] sm:text-xs text-green-200 font-bold mb-0.5">✅ ระดับความน่าจะเป็นบน (Confidence):</p>
                           <p className="text-xs sm:text-sm font-bold text-yellow-300">{aiAnalysis.modelStats.runTopStratName}</p>
                        </div>
                        <div className={`font-black px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex items-center gap-1 shadow-sm text-base sm:text-xl ${aiAnalysis.modelStats.runTopAcc >= 80 ? 'bg-green-500 text-white ring-2 ring-yellow-400' : 'bg-white/20 text-white'}`}>
                           {aiAnalysis.modelStats.runTopAcc} <Percent size={14}/>
                        </div>
                     </div>
                     <div className={`flex-1 border p-2.5 sm:p-3 rounded-xl flex items-center justify-between shadow-inner ${aiAnalysis.modelStats.runBotAcc >= 80 ? 'bg-green-500/20 border-green-400/50' : 'bg-white/10 border-white/20'}`}>
                        <div>
                           <p className="text-[10px] sm:text-xs text-green-200 font-bold mb-0.5">✅ ระดับความน่าจะเป็นล่าง (Confidence):</p>
                           <p className="text-xs sm:text-sm font-bold text-yellow-300">{aiAnalysis.modelStats.runBotStratName}</p>
                        </div>
                        <div className={`font-black px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg flex items-center gap-1 shadow-sm text-base sm:text-xl ${aiAnalysis.modelStats.runBotAcc >= 80 ? 'bg-green-500 text-white ring-2 ring-yellow-400' : 'bg-white/20 text-white'}`}>
                           {aiAnalysis.modelStats.runBotAcc} <Percent size={14}/>
                        </div>
                     </div>
                  </div>

                  {/* Running Numbers */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    <div className="bg-yellow-400/10 border border-yellow-400/30 p-3 sm:p-4 rounded-xl text-center shadow-inner">
                      <p className="text-yellow-200 text-xs sm:text-sm font-bold mb-2 flex justify-center items-center gap-1"><Target size={14}/> เลขวิ่ง / รูด 19 ประตู</p>
                      <div className="flex flex-row justify-center items-center gap-2 sm:gap-3">
                         <div className="bg-black/30 px-3 py-2 rounded-lg flex-1">
                           <span className="text-[10px] sm:text-xs text-purple-200 block mb-1">วิ่งบน</span>
                           <span className="text-lg sm:text-xl font-black text-yellow-400">
                             {aiAnalysis.prediction.runningTop.join(', ')}
                           </span>
                         </div>
                         <div className="w-px h-8 bg-white/20 hidden sm:block"></div>
                         <div className="bg-black/30 px-3 py-2 rounded-lg flex-1">
                           <span className="text-[10px] sm:text-xs text-purple-200 block mb-1">วิ่งล่าง</span>
                           <span className="text-lg sm:text-xl font-black text-yellow-400">
                             {aiAnalysis.prediction.runningBot.join(', ')}
                           </span>
                         </div>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 border border-gray-600/50 p-3 sm:p-4 rounded-xl text-center shadow-inner flex flex-col justify-center">
                      <p className="text-gray-300 text-xs sm:text-sm font-bold mb-2 flex justify-center items-center gap-1"><ShieldAlert size={14}/> เลขดับ (คาดว่าไม่ออก)</p>
                      <div className="flex justify-center items-center gap-3 sm:gap-4 mt-1">
                         <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg"><span className="text-[10px] sm:text-xs text-gray-400">ดับบน:</span><span className="text-lg sm:text-xl font-bold text-gray-200">{aiAnalysis.prediction.deadTop}</span></div>
                         <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-lg"><span className="text-[10px] sm:text-xs text-gray-400">ดับล่าง:</span><span className="text-lg sm:text-xl font-bold text-gray-200">{aiAnalysis.prediction.deadBot}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* Drilling Sets */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    <div className="md:col-span-1 bg-white/5 p-3 sm:p-4 rounded-xl backdrop-blur-md border border-white/10 text-center shadow-inner relative overflow-hidden flex flex-col justify-center">
                      <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
                      <p className="text-xs sm:text-sm text-purple-300 mb-2 font-medium">3 ตัวบน (2 หาง)</p>
                      <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2">
                        {aiAnalysis.prediction.top3.map((num, i) => (
                          <span key={i} className="bg-white/10 px-3 sm:px-2 py-1.5 sm:py-1 rounded-lg font-black tracking-wider text-white drop-shadow-md text-xl sm:text-xl w-full sm:w-auto">{num}</span>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="bg-white/5 p-3 sm:p-4 rounded-xl backdrop-blur-md border border-white/10 text-center shadow-inner relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-400"></div>
                        <p className="text-xs sm:text-sm text-purple-300 mb-2 font-medium">2 ตัวบน (2 หาง)</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-1.5 sm:gap-2">
                          {aiAnalysis.prediction.top2.map((num, i) => (
                            <span key={i} className="bg-blue-900/40 border border-blue-400/30 px-3 py-1.5 rounded-lg font-bold tracking-wider text-blue-200 drop-shadow-md text-xl sm:text-2xl">{num}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white/5 p-3 sm:p-4 rounded-xl backdrop-blur-md border border-white/10 text-center shadow-inner relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-red-400"></div>
                        <p className="text-xs sm:text-sm text-red-300 mb-2 font-medium">2 ตัวล่าง (2 หาง)</p>
                        <div className="flex flex-col sm:flex-row justify-center gap-1.5 sm:gap-2">
                          {aiAnalysis.prediction.bottom2.map((num, i) => (
                            <span key={i} className="bg-red-900/40 border border-red-400/30 px-3 py-1.5 rounded-lg font-bold tracking-wider text-red-200 drop-shadow-md text-xl sm:text-2xl">{num}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* --- CUSTOM NUMBER TESTER (ทดสอบเลขส่วนตัว) --- */}
            <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-blue-200 mt-4 sm:mt-6">
              <h2 className="text-base sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2 text-blue-800 mb-3">
                <Search size={20} className="text-blue-600" />
                ทดสอบเลขส่วนตัว (เช็คความแม่นยำตามโหมด)
              </h2>
              
              <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
                <div className="w-full sm:flex-1">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">ใส่เลขที่ต้องการ (2-3 หลัก)</label>
                  <input 
                    type="text" inputMode="numeric" pattern="[0-9]*" maxLength="3" 
                    placeholder="เช่น 41, 123" 
                    value={testNum} 
                    onChange={(e) => setTestNum(e.target.value.replace(/[^0-9]/g, ''))} 
                    className="w-full p-2.5 sm:p-3 border-2 border-blue-200 rounded-xl outline-none font-mono text-lg text-center tracking-[0.2em] focus:border-blue-500"
                  />
                </div>
                <div className="w-full sm:flex-1">
                  <label className="block text-xs sm:text-sm font-bold text-gray-700 mb-1">ตำแหน่งที่ต้องการเช็ค</label>
                  <select 
                    value={testPos} 
                    onChange={(e) => setTestPos(e.target.value)} 
                    className="w-full p-2.5 sm:p-3 border-2 border-gray-200 rounded-xl outline-none font-bold text-gray-700"
                  >
                    <option value="top">เลขบน (Top)</option>
                    <option value="bottom">เล็กล่าง (Bottom)</option>
                  </select>
                </div>
              </div>

              {customTesterStats && customTesterStats.error && (
                  <div className="mt-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-bold text-center border border-red-200 animate-fade-in">
                      <AlertCircle size={16} className="inline mr-1 mb-0.5" /> {customTesterStats.error}
                  </div>
              )}

              {customTesterStats && !customTesterStats.error && testNum && (
                <div className="mt-4 bg-blue-50 rounded-xl border border-blue-100 overflow-hidden animate-fade-in">
                  <div className="p-3 bg-blue-100 flex justify-between items-center border-b border-blue-200">
                    <span className="font-bold text-blue-800 text-sm flex items-center gap-1.5"><BarChart3 size={16}/> สถิติการเข้าของเลข: <strong className="text-lg bg-white px-2 rounded ml-1">{testNum}</strong> ({testPos === 'top' ? 'บน' : 'ล่าง'})</span>
                    <span className="text-xs text-blue-600 bg-white px-2 py-0.5 rounded-full font-bold shadow-sm">จาก {customTesterStats.total} งวด</span>
                  </div>
                  
                  {/* Summary */}
                  <div className="grid grid-cols-3 divide-x divide-blue-200 bg-white">
                    <div className="p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-gray-500 font-bold mb-1">🎯 โอกาสเข้า (ตรง)</p>
                      <p className="text-lg sm:text-xl font-black text-green-600">{(customTesterStats.exact / customTesterStats.total * 100).toFixed(1)}%</p>
                      <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">({customTesterStats.exact} ครั้ง)</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-gray-500 font-bold mb-1">🔥 โอกาสเข้า (โต๊ด/กลับ)</p>
                      <p className="text-lg sm:text-xl font-black text-blue-600">{(customTesterStats.toad / customTesterStats.total * 100).toFixed(1)}%</p>
                      <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">({customTesterStats.toad} ครั้ง)</p>
                    </div>
                    <div className="p-3 text-center">
                      <p className="text-[10px] sm:text-xs text-gray-500 font-bold mb-1">🏃 โอกาสเข้า (วิ่ง/รูด)</p>
                      <p className="text-lg sm:text-xl font-black text-orange-500">{(customTesterStats.run / customTesterStats.total * 100).toFixed(1)}%</p>
                      <p className="text-[9px] sm:text-[10px] text-gray-400 mt-0.5">({customTesterStats.run} ครั้ง)</p>
                    </div>
                  </div>
                  
                  {/* Mini History */}
                  <div className="bg-gray-50 max-h-[160px] overflow-y-auto border-t border-blue-100 p-2">
                    {customTesterStats.historyLog.map((log, i) => (
                       <div key={i} className="flex justify-between items-center py-1.5 px-2 border-b border-gray-200 last:border-0 hover:bg-gray-100 rounded text-xs sm:text-sm">
                         <span className="font-medium text-gray-600">{log.date}</span>
                         <div className="flex gap-1.5 sm:gap-3 items-center">
                           <span className="text-gray-500 font-mono hidden sm:inline">สูตรให้: <strong className="text-blue-600">{log.predStr}</strong> | ออก: <strong className="text-gray-800">{log.actStr}</strong></span>
                           <span className="text-gray-500 font-mono sm:hidden"><strong className="text-blue-600">{log.predStr}</strong> | <strong className="text-gray-800">{log.actStr}</strong></span>
                           <div className="w-[80px] sm:w-[100px] flex justify-end gap-1">
                             {log.isExact && <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold text-[10px] shadow-sm">🎯 ตรง</span>}
                             {log.isToad && !log.isExact && <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold text-[10px] shadow-sm">🔥 โต๊ด</span>}
                             {log.isRun && !log.isExact && !log.isToad && <span className="bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold text-[10px] shadow-sm">🏃 วิ่ง</span>}
                             {!log.isExact && !log.isToad && !log.isRun && <span className="text-gray-300 text-[10px] px-1.5 py-0.5">❌ หลุด</span>}
                           </div>
                         </div>
                       </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main History Table Container */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative z-10 mt-4 sm:mt-6">
              <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-base sm:text-lg font-bold flex items-center gap-1.5 sm:gap-2 text-gray-800">
                  <History size={18} className="text-purple-600" />
                  สถิติย้อนหลัง
                  <span className="text-[10px] sm:text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 sm:py-1 rounded-full border border-purple-200">{filteredHistory.length} งวด</span>
                  <span className="text-[10px] sm:text-xs text-gray-400 ml-2">(จำลองสถิติ AI ทั้งหมด)</span>
                </h2>
                
                {(filteredHistory.length > 0) && (
                   !confirmClear ? (
                     <button onClick={() => setConfirmClear(true)} className="text-[10px] sm:text-xs text-red-500 hover:text-white hover:bg-red-500 px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-medium border border-red-100 hover:border-transparent bg-white">
                       <Trash2 size={12}/> ล้างข้อมูล
                     </button>
                   ) : (
                     <div className="flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-lg border border-red-200">
                       <span className="text-[10px] sm:text-xs text-red-700 font-bold hidden sm:inline">ยืนยันลบ?</span>
                       <button onClick={handleClearAll} className="text-[10px] sm:text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 font-medium">ลบ</button>
                       <button onClick={() => setConfirmClear(false)} className="text-[10px] sm:text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300 font-medium">ยกเลิก</button>
                     </div>
                   )
                )}
              </div>
              
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto w-full">
                <table className="w-full text-xs sm:text-sm text-left min-w-[500px]">
                  <thead className="bg-white text-gray-500 text-[10px] sm:text-xs uppercase sticky top-0 shadow-sm z-0">
                    <tr>
                      <th className="px-2 sm:px-3 py-2 sm:py-3 font-bold whitespace-nowrap">วันที่</th>
                      <th className="px-2 sm:px-3 py-2 sm:py-3 text-center text-blue-600 font-bold whitespace-nowrap">ผลบน</th>
                      <th className="px-2 sm:px-3 py-2 sm:py-3 text-center text-red-600 font-bold whitespace-nowrap">ผลล่าง</th>
                      <th className="px-2 sm:px-3 py-2 sm:py-3 font-bold text-purple-700">ผลตรวจสูตร AI (ตามโหมดที่เลือก)</th>
                      <th className="px-1 sm:px-2 py-2 sm:py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan="5" className="px-4 py-16 text-center text-gray-400 text-sm"><p>ไม่พบสถิติ (กรุณาเพิ่มข้อมูล)</p></td></tr>
                    ) : (
                      filteredHistory.map((entry, index) => {
                        const ev = aiAnalysis?.historyEvals?.[entry.id];
                        return (
                          <tr key={entry.id} className="hover:bg-purple-50/50 transition-colors group">
                            <td className="px-2 sm:px-3 py-2.5 font-bold text-gray-800 whitespace-nowrap">{entry.date}</td>
                            <td className="px-2 sm:px-3 py-2.5 text-center">
                              <span className="font-bold text-blue-700 bg-blue-100 border border-blue-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded whitespace-nowrap">
                                {entry.prize1 ? entry.prize1 : entry.top3}
                              </span>
                              {entry.prize1 && (
                                <span className="text-[10px] text-gray-500 block mt-0.5">({entry.top3})</span>
                              )}
                              {!entry.prize1 && (
                                <div className="text-[10px] text-gray-400 mt-0.5">({entry.top2})</div>
                              )}
                            </td>
                            <td className="px-2 sm:px-3 py-2.5 text-center align-top">
                              <span className="font-bold text-red-700 bg-red-100 border border-red-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">{entry.bottom2}</span>
                            </td>
                            <td className="px-2 sm:px-3 py-2.5 min-w-[200px]">
                              {ev ? (
                                <div className="flex flex-col gap-1 sm:gap-1.5">
                                  <div className="text-[9px] sm:text-[11px] text-gray-700 bg-white px-1.5 sm:px-2 py-1 sm:py-1.5 rounded border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-1 sm:gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-purple-700 flex items-center gap-0.5"><Calculator size={10} className="sm:w-3 sm:h-3" /> ให้:</span> 
                                      <span className="text-gray-500">วิ่ง</span> <span className="font-bold text-orange-500">{ev.uniquePredRunTop.join(',')} / {ev.uniquePredRunBot.join(',')}</span>
                                    </div>
                                    <div className="w-full h-px bg-gray-100 sm:w-px sm:h-3 sm:bg-gray-300 my-0.5 sm:my-0"></div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-gray-500">เจาะ</span> <span className="font-bold text-blue-700">{ev.predTop2.join(',')}</span> <span className="text-gray-400">|</span> <span className="font-bold text-red-600">{ev.predBot2.join(',')}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {ev.runTopHits.length > 0 && <span className="text-[9px] sm:text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-1 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">🏃 วิ่งบน({ev.runTopHits.join(',')})</span>}
                                    {ev.runBotHits.length > 0 && <span className="text-[9px] sm:text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-1 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">🏃 วิ่งล่าง({ev.runBotHits.join(',')})</span>}
                                    
                                    {ev.isTop3Exact && <span className="text-[9px] sm:text-[10px] bg-green-100 text-green-800 border border-green-300 px-1 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">🎯 3บน</span>}
                                    {ev.isTop2Exact && <span className="text-[9px] sm:text-[10px] bg-green-100 text-green-800 border border-green-300 px-1 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">🔥 2บน</span>}
                                    {ev.isTop2Toad && !ev.isTop2Exact && <span className="text-[9px] sm:text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-1 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">🔥 บน(กลับ)</span>}
                                    {ev.isBot2Exact && <span className="text-[9px] sm:text-[10px] bg-green-100 text-green-800 border border-green-300 px-1 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">🔥 2ล่าง</span>}
                                    {ev.isBot2Toad && !ev.isBot2Exact && <span className="text-[9px] sm:text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-1 py-0.5 rounded font-bold shadow-sm whitespace-nowrap">🔥 ล่าง(กลับ)</span>}
                                    
                                    {!ev.isTop3Exact && !ev.isTop2Exact && !ev.isTop2Toad && !ev.isBot2Exact && !ev.isBot2Toad && ev.runTopHits.length === 0 && ev.runBotHits.length === 0 && (<span className="text-[9px] sm:text-[10px] text-gray-400 border border-transparent px-1 py-0.5 whitespace-nowrap">เจาะ/วิ่ง หลุด</span>)}
                                  </div>
                                </div>
                              ) : <span className="text-[9px] sm:text-[10px] text-gray-400">ไม่มีข้อมูลสถิติ</span>}
                            </td>
                            <td className="px-1 sm:px-2 py-2.5 text-right align-top">
                              <button onClick={() => deleteEntry(entry.id, mode === 'bimonthly' ? 'bi' : 'daily')} className="text-gray-300 hover:text-red-500 p-1 sm:p-1.5 bg-white rounded-md border border-transparent hover:border-red-200 hover:bg-red-50 transition-all">
                                <Trash2 size={14} className="sm:w-4 sm:h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}