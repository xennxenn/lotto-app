import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calculator, Calendar, History, AlertCircle, Trash2, Upload, CheckCircle2, Clock, Tag, Edit3, ClipboardPaste, Filter, Zap, Target, ShieldAlert, Percent, Beaker } from 'lucide-react';

// --- FIX CSS FOR ONLINE DEPLOYMENT (Vercel/Vite) ---
// บังคับโหลด Tailwind CSS ทันทีตั้งแต่เริ่มอ่านไฟล์ JS (เพื่อป้องกันหน้าเว็บโล้น)
if (typeof window !== 'undefined' && !document.getElementById('tailwind-cdn-script')) {
  const script = document.createElement('script');
  script.id = 'tailwind-cdn-script';
  script.src = 'https://cdn.tailwindcss.com';
  document.head.appendChild(script);
}

const LOTTERY_TYPES = {
  bimonthly: ['หวยรัฐบาลไทย', 'หวยออมสิน', 'หวย ธ.ก.ส.', 'อื่นๆ (พิมพ์ระบุเอง)'],
  daily: [
    'ฮานอยปกติ', 'ฮานอยพิเศษ', 'ฮานอย VIP', 
    'หวยฮานอยเช้า', 'หวยฮานอยเที่ยง', 
    'หวยลาวพัฒนา', 'หวยลาวเช้า', 'หวยลาวเที่ยง', 'หวยลาวดิจิตอล',
    'หวยมาเลย์', 'หุ้นไทย', 'ยี่กี', 'อื่นๆ (พิมพ์ระบุเอง)'
  ]
};

// --- PRE-GENERATE STRATEGIES ---
const STRATS = [];
let stratIdCount = 1;

for(let i=0; i<5; i++) for(let c=0; c<10; c++) STRATS.push({t:'s', i, c, id: stratIdCount++});

for(let i=0; i<5; i++) {
    for(let j=i+1; j<5; j++) {
        for(let c=0; c<10; c++) {
            STRATS.push({t:'p_add', i, j, c, id: stratIdCount++});
            STRATS.push({t:'p_diff', i, j, c, id: stratIdCount++});
        }
    }
}

const TRIPLETS = [[0,1,2],[0,3,4],[1,2,3],[2,3,4]];
for(let tr of TRIPLETS) for(let c=0; c<10; c++) STRATS.push({t:'tr', p:tr, c, id: stratIdCount++});

let seed = 12345;
const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
for(let k=0; k<3500; k++) {
    STRATS.push({
        t: 'adv', id: stratIdCount++,
        w: [Math.floor(random()*9), Math.floor(random()*9), Math.floor(random()*9), Math.floor(random()*9), Math.floor(random()*9)],
        c: Math.floor(random()*10)
    });
}

const evaluateStrat = (s, d) => {
    if(s.t==='s') return (d[s.i]+s.c)%10;
    if(s.t==='p_add') return (d[s.i]+d[s.j]+s.c)%10;
    if(s.t==='p_diff') return (Math.abs(d[s.i]-d[s.j])+s.c)%10;
    if(s.t==='tr') return (d[s.p[0]]+d[s.p[1]]+d[s.p[2]]+s.c)%10;
    if(s.t==='adv') return (d[0]*s.w[0] + d[1]*s.w[1] + d[2]*s.w[2] + d[3]*s.w[3] + d[4]*s.w[4] + s.c)%10;
    return 0;
};

const getStratName = (s) => {
    if(s.t==='s') return `ดึงหลักเดี่ยว #${s.id}`;
    if(s.t==='p_add') return `ผลบวกคู่ #${s.id}`;
    if(s.t==='p_diff') return `ผลต่างคู่ #${s.id}`;
    if(s.t==='tr') return `สามสหาย #${s.id}`;
    if(s.t==='adv') return `สูตรเซียน #${s.id}`;
    return `สูตรเฉพาะกิจ`;
}

const CFUNCS = {
    H: (c, p) => c[0] === p,
    T: (c, p) => c[1] === p,
    U: (c, p) => c[2] === p,
    Bt: (c, p) => c[3] === p,
    Bu: (c, p) => c[4] === p,
    RunTop: (c, p) => c[1] === p || c[2] === p, 
    RunBot: (c, p) => c[3] === p || c[4] === p, 
};

export default function App() {
  const [mode, setMode] = useState('daily');
  const [inputMode, setInputMode] = useState('import');
  
  // โหลดข้อมูลจาก Local Storage เพื่อให้ข้อมูลไม่หายเวลา Deploy แล้วรีเฟรชหน้าเว็บ
  const [bimonthlyHistory, setBimonthlyHistory] = useState(() => {
    try { const localData = localStorage.getItem('lotto_bimonthly'); return localData ? JSON.parse(localData) : []; } catch(e) { return []; }
  });
  const [dailyHistory, setDailyHistory] = useState(() => {
    try { const localData = localStorage.getItem('lotto_daily'); return localData ? JSON.parse(localData) : []; } catch(e) { return []; }
  });

  // บันทึกข้อมูลลง Local Storage เมื่อมีการเปลี่ยนแปลง
  useEffect(() => { localStorage.setItem('lotto_bimonthly', JSON.stringify(bimonthlyHistory)); }, [bimonthlyHistory]);
  useEffect(() => { localStorage.setItem('lotto_daily', JSON.stringify(dailyHistory)); }, [dailyHistory]);
  
  const [historyFilter, setHistoryFilter] = useState('ทั้งหมด');
  const [showPrediction, setShowPrediction] = useState(false);
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [confirmClear, setConfirmClear] = useState(false);

  const [biForm, setBiForm] = useState({ lotteryType: 'หวยรัฐบาลไทย', customName: '', drawTime: '15:30', date: '', prize1: '', front1: '', front2: '', back1: '', back2: '', bottom2: '' });
  const [dailyForm, setDailyForm] = useState({ lotteryType: 'ฮานอยปกติ', customName: '', drawTime: '18:30', date: '', top3: '', bottom2: '' });
  const [importText, setImportText] = useState('');
  
  const currentHistory = mode === 'bimonthly' ? bimonthlyHistory : dailyHistory;
  
  const uniqueLotteryNames = useMemo(() => {
    return ['ทั้งหมด', ...new Set(currentHistory.map(item => item.lotteryName))];
  }, [currentHistory]);

  const filteredHistory = useMemo(() => {
    if (historyFilter === 'ทั้งหมด') return currentHistory;
    return currentHistory.filter(item => item.lotteryName === historyFilter);
  }, [currentHistory, historyFilter]);

  useEffect(() => { setShowPrediction(false); }, [filteredHistory, mode]);

  const getLotteryName = (form) => form.lotteryType === 'อื่นๆ (พิมพ์ระบุเอง)' ? (form.customName || 'ไม่ระบุชื่อ') : form.lotteryType;
  
  const showMessage = (msg, type = 'error') => {
    if (type === 'error') { setError(msg); setSuccessMsg(''); } else { setSuccessMsg(msg); setError(''); }
    setTimeout(() => { setError(''); setSuccessMsg(''); }, 4000);
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
    const numericFields = ['prize1', 'front1', 'front2', 'back1', 'back2', 'bottom2', 'top3'];
    let finalValue = value;
    if (numericFields.includes(name)) finalValue = value.replace(/[^0-9]/g, '');
    formSetter(prev => ({ ...prev, [name]: finalValue }));
  };

  const saveBimonthly = () => {
    if (!biForm.date || biForm.prize1.length !== 6 || biForm.bottom2.length !== 2) { showMessage('กรุณากรอก วันที่, รางวัลที่ 1 (6 หลัก) และ 2 ตัวล่างให้ครบถ้วน', 'error'); return; }
    const finalName = getLotteryName(biForm);
    const newEntry = { id: Date.now(), ...biForm, lotteryName: finalName, top3: biForm.prize1.slice(-3), top2: biForm.prize1.slice(-2) };
    setBimonthlyHistory([newEntry, ...bimonthlyHistory]);
    setBiForm(prev => ({ ...prev, date: '', prize1: '', front1: '', front2: '', back1: '', back2: '', bottom2: '' }));
    setHistoryFilter(finalName); showMessage('บันทึกสถิติสำเร็จ', 'success');
  };

  const saveDaily = () => {
    if (!dailyForm.date || dailyForm.top3.length !== 3 || dailyForm.bottom2.length !== 2) { showMessage('กรุณากรอก วันที่, 3 ตัวบน (3 หลัก) และ 2 ตัวล่างให้ครบถ้วน', 'error'); return; }
    const finalName = getLotteryName(dailyForm);
    const newEntry = { id: Date.now(), ...dailyForm, lotteryName: finalName, top2: dailyForm.top3.slice(-2) };
    setDailyHistory([newEntry, ...dailyHistory]);
    setDailyForm(prev => ({ ...prev, date: '', top3: '', bottom2: '' }));
    setHistoryFilter(finalName); showMessage('บันทึกสถิติสำเร็จ', 'success');
  };

  const processImport = () => {
    if (!importText.trim()) { showMessage('กรุณาวางข้อมูลก่อนกดนำเข้า', 'error'); return; }
    const lines = importText.trim().split(/\r?\n/);
    const newEntries = [];
    let errorCount = 0; let autoFilterName = 'ทั้งหมด';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(/[\s,]+/).filter(Boolean);
      if (parts.length === 0) continue;

      if (mode === 'daily') {
        let name = getLotteryName(dailyForm), time = dailyForm.drawTime || '00:00', date = '', top3 = '', bottom2 = '';
        if (parts.length === 3) [date, top3, bottom2] = parts;
        else if (parts.length === 4) [name, date, top3, bottom2] = parts;
        else if (parts.length >= 5) [name, date, time, top3, bottom2] = parts;
        else { errorCount++; continue; }

        top3 = top3.replace(/[^0-9]/g, ''); bottom2 = bottom2.replace(/[^0-9]/g, '');
        if (top3.length === 3 && bottom2.length === 2) { newEntries.push({ id: Date.now() + i, lotteryName: name, drawTime: time, date, top3, bottom2, top2: top3.slice(-2) }); autoFilterName = name; } 
        else { errorCount++; }
      } else {
        let name = getLotteryName(biForm), time = biForm.drawTime || '15:30', date = '', prize1 = '', bottom2 = '';
        if (parts.length === 3) [date, prize1, bottom2] = parts;
        else if (parts.length === 5) [name, date, time, prize1, bottom2] = parts;
        else if (parts.length >= 7) { date = parts[0]; prize1 = parts[1]; bottom2 = parts[parts.length - 1]; } 
        else { errorCount++; continue; }

        prize1 = prize1.replace(/[^0-9]/g, ''); bottom2 = bottom2.replace(/[^0-9]/g, '');
        if (prize1.length === 6 && bottom2.length === 2) { newEntries.push({ id: Date.now() + i, lotteryName: name, drawTime: time, date, prize1, bottom2, top3: prize1.slice(-3), top2: prize1.slice(-2) }); autoFilterName = name; } 
        else { errorCount++; }
      }
    }

    if (newEntries.length > 0) {
      if (mode === 'daily') setDailyHistory(prev => [...newEntries, ...prev]);
      else setBimonthlyHistory(prev => [...newEntries, ...prev]);
      setImportText('');
      if (newEntries.every(e => e.lotteryName === autoFilterName)) setHistoryFilter(autoFilterName);
      showMessage(`นำเข้าสำเร็จ ${newEntries.length} งวด ${errorCount > 0 ? `(ข้ามแถวที่ผิด ${errorCount})` : ''}`, 'success');
      setInputMode('manual');
    } else showMessage('ไม่พบข้อมูลที่ตรงกับรูปแบบ', 'error');
  };

  const handleClearAll = () => {
    if (mode === 'bimonthly') {
      if (historyFilter === 'ทั้งหมด') setBimonthlyHistory([]);
      else setBimonthlyHistory(bimonthlyHistory.filter(item => item.lotteryName !== historyFilter));
    } else {
      if (historyFilter === 'ทั้งหมด') setDailyHistory([]);
      else setDailyHistory(dailyHistory.filter(item => item.lotteryName !== historyFilter));
    }
    setConfirmClear(false); setHistoryFilter('ทั้งหมด'); setShowPrediction(false);
  };

  const deleteEntry = (id, historyType) => {
    if (historyType === 'bi') setBimonthlyHistory(bimonthlyHistory.filter(item => item.id !== id));
    else setDailyHistory(dailyHistory.filter(item => item.id !== id));
  };


  // --- AI TRUE WALK-FORWARD + ENSEMBLE VOTING OPTIMIZER ---
  const aiAnalysis = useMemo(() => {
    if (historyFilter === 'ทั้งหมด' || filteredHistory.length < 2) return null;

    const history = filteredHistory;
    const numDraws = history.length;

    const D = history.map(entry => [
      parseInt(entry.top3[0]||0), parseInt(entry.top3[1]||0), parseInt(entry.top3[2]||0),
      parseInt(entry.bottom2[0]||0), parseInt(entry.bottom2[1]||0)
    ]);

    const getTopStratsForTarget = (targetIdx, hitCondition, isDead = false) => {
        const standIdx = targetIdx + 1; 
        let results = [];
        let totalTests = numDraws - 1 - standIdx; 

        if (totalTests <= 0) totalTests = 1; 

        for (let s of STRATS) {
            let score = 0;
            let rawHits = 0;
            for (let t = standIdx + 1; t < numDraws; t++) {
                const prevD = D[t];
                const currD = D[t-1];
                const pred = evaluateStrat(s, prevD);
                const hit = hitCondition(currD, pred);

                if (isDead) {
                    if (!hit) { 
                        score += 1; rawHits++; 
                        if (t === standIdx + 1) score += 10; 
                        else if (t <= standIdx + 3) score += 5; 
                        else if (t <= standIdx + 7) score += 2;
                    }
                } else {
                    if (hit) { 
                        score += 1; rawHits++; 
                        if (t === standIdx + 1) score += 10; 
                        else if (t <= standIdx + 3) score += 5; 
                        else if (t <= standIdx + 7) score += 2; 
                    }
                }
            }
            results.push({ s, score, rawHits, totalTests });
        }
        return results.sort((a,b) => b.score - a.score);
    };

    const getEnsembleTopN = (ranked, data, n, poolSize = 50) => {
        const counts = {};
        const limit = Math.min(poolSize, ranked.length);
        for (let i = 0; i < limit; i++) {
            const v = evaluateStrat(ranked[i].s, data);
            counts[v] = (counts[v] || 0) + ranked[i].score;
        }
        const sortedVals = Object.keys(counts).sort((a,b) => counts[b] - counts[a]);
        return sortedVals.slice(0, n).map(Number);
    };

    let hits = { top3: 0, top2: 0, bottom2: 0, topRun: 0, botRun: 0, deadTopPass: 0, deadBotPass: 0 };
    let historyEvals = {}; 

    // 1. จำลองการทำนายในอดีต 
    for(let k = 0; k < numDraws - 1; k++) {
        const entryId = history[k].id;
        const standD = D[k+1];

        const optH = getTopStratsForTarget(k, CFUNCS.H);
        const optT = getTopStratsForTarget(k, CFUNCS.T);
        const optU = getTopStratsForTarget(k, CFUNCS.U);
        const optBt = getTopStratsForTarget(k, CFUNCS.Bt);
        const optBu = getTopStratsForTarget(k, CFUNCS.Bu);

        const optRunTop = getTopStratsForTarget(k, CFUNCS.RunTop);
        const optRunBot = getTopStratsForTarget(k, CFUNCS.RunBot);
        const optDeadTop = getTopStratsForTarget(k, CFUNCS.RunTop, true);
        const optDeadBot = getTopStratsForTarget(k, CFUNCS.RunBot, true);

        const [h1] = getEnsembleTopN(optH, standD, 1);
        const [t1] = getEnsembleTopN(optT, standD, 1);
        const uVals = getEnsembleTopN(optU, standD, 2);
        
        const [bt1] = getEnsembleTopN(optBt, standD, 1);
        const buVals = getEnsembleTopN(optBu, standD, 2);

        const runTopArr = getEnsembleTopN(optRunTop, standD, 2);
        const runBotArr = getEnsembleTopN(optRunBot, standD, 2);
        const deadTop = getEnsembleTopN(optDeadTop, standD, 1)[0];
        const deadBot = getEnsembleTopN(optDeadBot, standD, 1)[0];

        const predTop2Arr = uVals.map(u => `${t1}${u}`);
        const predBot2Arr = buVals.map(bu => `${bt1}${bu}`);
        const predTop3Arr = predTop2Arr.map(p => `${h1}${p}`);

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

    // 2. ทำนายงวดพรุ่งนี้ 
    const todayD = D[0];
    
    const optH_Tmrw = getTopStratsForTarget(-1, CFUNCS.H);
    const optT_Tmrw = getTopStratsForTarget(-1, CFUNCS.T);
    const optU_Tmrw = getTopStratsForTarget(-1, CFUNCS.U);
    const optBt_Tmrw = getTopStratsForTarget(-1, CFUNCS.Bt);
    const optBu_Tmrw = getTopStratsForTarget(-1, CFUNCS.Bu);

    const runTopTmrw = getTopStratsForTarget(-1, CFUNCS.RunTop);
    const runBotTmrw = getTopStratsForTarget(-1, CFUNCS.RunBot);
    const deadTopTmrw = getTopStratsForTarget(-1, CFUNCS.RunTop, true);
    const deadBotTmrw = getTopStratsForTarget(-1, CFUNCS.RunBot, true);

    const [h1_Tmrw] = getEnsembleTopN(optH_Tmrw, todayD, 1);
    const [t1_Tmrw] = getEnsembleTopN(optT_Tmrw, todayD, 1);
    const uVals_Tmrw = getEnsembleTopN(optU_Tmrw, todayD, 2);
    
    const [bt1_Tmrw] = getEnsembleTopN(optBt_Tmrw, todayD, 1);
    const buVals_Tmrw = getEnsembleTopN(optBu_Tmrw, todayD, 2);

    const nextRunTop = getEnsembleTopN(runTopTmrw, todayD, 2);
    const nextRunBot = getEnsembleTopN(runBotTmrw, todayD, 2);

    const nDeadTop = getEnsembleTopN(deadTopTmrw, todayD, 1)[0];
    const nDeadBot = getEnsembleTopN(deadBotTmrw, todayD, 1)[0];

    const nextTop2 = uVals_Tmrw.map(u => `${t1_Tmrw}${u}`);
    const nextBot2 = buVals_Tmrw.map(bu => `${bt1_Tmrw}${bu}`);
    const nextTop3 = nextTop2.map(p => `${h1_Tmrw}${p}`);

    const runTopAcc = Math.round((runTopTmrw[0].rawHits / runTopTmrw[0].totalTests) * 100) || 0;
    const runBotAcc = Math.round((runBotTmrw[0].rawHits / runBotTmrw[0].totalTests) * 100) || 0;

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
            runTopHits: runTopTmrw[0].rawHits,
            runBotHits: runBotTmrw[0].rawHits,
            totalTests: runTopTmrw[0].totalTests,
            runTopAcc, runBotAcc,
            runTopStratName: "AI Ensemble (โหวต 50 สูตรที่ดีที่สุด)",
            runBotStratName: "AI Ensemble (โหวต 50 สูตรที่ดีที่สุด)"
        },
        hits: hits,
        historyEvals: historyEvals
    };
  }, [filteredHistory, historyFilter]);


  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-10">
      <header className="bg-purple-900 text-white p-4 shadow-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto flex items-center justify-center sm:justify-start gap-3">
          <Zap size={28} className="text-yellow-400" />
          <h1 className="text-2xl font-bold tracking-wide">Lotto AI Optimizer <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-black ml-1 shadow">V.21 ONLINE</span></h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 mt-4">
        
        <div className="flex bg-white rounded-xl shadow-sm overflow-hidden mb-6 border border-gray-200 p-1">
          <button onClick={() => { setMode('daily'); setHistoryFilter('ทั้งหมด'); setShowPrediction(false); }} className={`flex-1 py-3 font-bold text-center rounded-lg transition-all ${mode === 'daily' ? 'bg-purple-100 text-purple-800 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
            หวยรายวัน (ฮานอย, ลาว, ฯลฯ)
          </button>
          <button onClick={() => { setMode('bimonthly'); setHistoryFilter('ทั้งหมด'); setShowPrediction(false); }} className={`flex-1 py-3 font-bold text-center rounded-lg transition-all ${mode === 'bimonthly' ? 'bg-purple-100 text-purple-800 shadow-sm' : 'text-gray-500 hover:bg-gray-50'}`}>
            หวยรัฐบาล (วันที่ 1, 16)
          </button>
        </div>

        {error && (<div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded shadow-sm flex items-center gap-2"><AlertCircle size={20} /> <p>{error}</p></div>)}
        {successMsg && (<div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-4 rounded shadow-sm flex items-center gap-2"><CheckCircle2 size={20} /> <p>{successMsg}</p></div>)}

        <div className="grid lg:grid-cols-12 gap-6">
          
          <div className="lg:col-span-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex bg-gray-100 p-1 rounded-xl mb-6">
              <button onClick={() => setInputMode('import')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${inputMode === 'import' ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <ClipboardPaste size={16} /> นำเข้าหลายงวด
              </button>
              <button onClick={() => setInputMode('manual')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-bold rounded-lg transition-all ${inputMode === 'manual' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                <Edit3 size={16} /> กรอกทีละงวด
              </button>
            </div>

            {inputMode === 'import' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                  <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><Tag size={14} className="text-purple-600"/> กำหนดชื่อหวยอัตโนมัติ:</label>
                  <select 
                    className="w-full p-2.5 border border-purple-200 rounded-lg outline-none font-medium text-purple-900 focus:ring-2 focus:ring-purple-400 bg-white"
                    value={mode === 'bimonthly' ? biForm.lotteryType : dailyForm.lotteryType}
                    onChange={(e) => handleLotteryTypeChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)}
                  >
                    {LOTTERY_TYPES[mode].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                  </select>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-lg text-sm text-yellow-800">
                  <p className="font-bold flex items-center gap-1 mb-1"><ClipboardPaste size={16}/> ก๊อปปี้มาวางได้เลย!</p>
                  <p>รูปแบบ: <span className="font-bold">วันที่, 3ตัวบน, 2ตัวล่าง</span></p>
                  <p className="text-xs mt-1 text-gray-500">(เช่น: `14/04/69  763  33`)</p>
                </div>
                <textarea 
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  className="w-full h-48 p-4 border-2 border-purple-200 rounded-xl focus:ring-4 focus:ring-purple-100 focus:border-purple-500 outline-none font-mono text-sm shadow-inner bg-white"
                  placeholder={mode === 'daily' ? "14/04/69  763  33\n13/04/69  738  09\n12/04/69  000  62\n11/04/69  204  03" : "16/04/69  123456  88\n01/04/69  987654  99"}
                />
                <button onClick={processImport} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-colors text-lg flex justify-center items-center gap-2">
                  <Upload size={20}/> นำเข้าข้อมูล
                </button>
              </div>
            )}

            {inputMode === 'manual' && (
              <div className="space-y-4 animate-fade-in">
                <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-4">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Tag size={14} className="text-purple-600"/> เลือกหวย</label>
                    <select 
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-none text-sm bg-white"
                      value={mode === 'bimonthly' ? biForm.lotteryType : dailyForm.lotteryType}
                      onChange={(e) => handleLotteryTypeChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)}
                    >
                      {LOTTERY_TYPES[mode].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  </div>
                  {(mode === 'bimonthly' ? biForm.lotteryType : dailyForm.lotteryType) === 'อื่นๆ (พิมพ์ระบุเอง)' && (
                    <input type="text" name="customName" placeholder="พิมพ์ชื่อหวย..." value={mode === 'bimonthly' ? biForm.customName : dailyForm.customName} onChange={(e) => handleChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)} className="w-full p-2 border border-gray-300 rounded-lg outline-none text-sm bg-white" />
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Calendar size={14} className="text-purple-600"/> วันที่</label>
                      <input type="text" name="date" placeholder="DD/MM/YY" value={mode === 'bimonthly' ? biForm.date : dailyForm.date} onChange={(e) => handleChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Clock size={14} className="text-purple-600"/> เวลาออก</label>
                      <input type="time" name="drawTime" value={mode === 'bimonthly' ? biForm.drawTime : dailyForm.drawTime} onChange={(e) => handleChange(e, mode === 'bimonthly' ? setBiForm : setDailyForm)} className="w-full p-2.5 border border-gray-300 rounded-lg outline-none text-sm" />
                    </div>
                  </div>
                </div>

                {mode === 'bimonthly' ? (
                  <div className="space-y-4 pt-2">
                    <div><label className="block text-sm font-bold text-gray-700 mb-1">รางวัลที่ 1 (6 หลัก)</label><input type="text" name="prize1" maxLength="6" placeholder="123456" value={biForm.prize1} onChange={(e) => handleChange(e, setBiForm)} className="w-full p-3 border-2 border-gray-300 rounded-xl outline-none font-mono text-center text-lg tracking-widest focus:border-purple-500" /></div>
                    <div><label className="block text-sm font-bold text-red-600 mb-1">เลขท้าย 2 ตัวล่าง</label><input type="text" name="bottom2" maxLength="2" placeholder="99" value={biForm.bottom2} onChange={(e) => handleChange(e, setBiForm)} className="w-full p-3 border-2 border-red-200 rounded-xl outline-none font-mono text-center text-lg tracking-widest focus:border-red-500" /></div>
                    <button onClick={saveBimonthly} className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold py-3 px-4 border border-indigo-200 rounded-xl transition-colors mt-2 shadow-sm">+ เพิ่มเข้าคลังสถิติ</button>
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    <div><label className="block text-sm font-bold text-blue-600 mb-1">3 ตัวบน</label><input type="text" name="top3" maxLength="3" placeholder="456" value={dailyForm.top3} onChange={(e) => handleChange(e, setDailyForm)} className="w-full p-4 border-2 border-blue-200 rounded-xl outline-none font-mono text-center text-2xl tracking-widest focus:border-blue-500" /></div>
                    <div><label className="block text-sm font-bold text-red-600 mb-1">2 ตัวล่าง</label><input type="text" name="bottom2" maxLength="2" placeholder="88" value={dailyForm.bottom2} onChange={(e) => handleChange(e, setDailyForm)} className="w-full p-4 border-2 border-red-200 rounded-xl outline-none font-mono text-center text-2xl tracking-widest focus:border-red-500" /></div>
                    <button onClick={saveDaily} className="w-full bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white font-bold py-3 px-4 border border-indigo-200 rounded-xl transition-colors mt-4 shadow-sm">+ เพิ่มเข้าคลังสถิติ</button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="lg:col-span-8 space-y-6">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-purple-200 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-20">
              <div className="flex items-center gap-2 text-purple-800">
                <Filter size={20} className="text-purple-600"/>
                <h3 className="font-bold">คัดแยกหวย:</h3>
              </div>
              <select className="w-full sm:w-64 p-2.5 border-2 border-purple-300 rounded-xl outline-none font-bold text-purple-900 bg-purple-50 cursor-pointer" value={historyFilter} onChange={(e) => setHistoryFilter(e.target.value)}>
                {uniqueLotteryNames.map(name => <option key={name} value={name}>{name === 'ทั้งหมด' ? 'เลือกหวย...' : name}</option>)}
              </select>
            </div>
            
            <div className="bg-gradient-to-br from-indigo-900 via-purple-900 to-indigo-950 p-6 rounded-2xl shadow-lg text-white relative overflow-hidden z-10">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500 opacity-10 rounded-full -mr-20 -mt-20 blur-3xl"></div>
              
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 relative z-10 gap-4">
                <div>
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Zap size={24} className="text-yellow-400"/>
                    AI ชุดเจาะ 2 หาง (ระบบโหวต 50 สูตร)
                  </h2>
                  <p className="text-xs text-purple-200 mt-1">ทำนายผล<strong className="text-yellow-300">งวดถัดไป</strong> ของ <strong className="text-white">{historyFilter === 'ทั้งหมด' ? '...' : historyFilter}</strong></p>
                </div>
                
                {historyFilter === 'ทั้งหมด' ? (
                  <div className="bg-white/10 px-4 py-2 rounded-lg border border-white/20 text-sm text-purple-200">โปรดเลือกหวยด้านบนก่อน</div>
                ) : (
                  <button onClick={() => setShowPrediction(true)} className="bg-yellow-400 hover:bg-yellow-500 text-indigo-900 font-black py-3 px-8 rounded-xl shadow-[0_0_15px_rgba(250,204,21,0.4)] transition-all transform hover:scale-105 text-sm w-full sm:w-auto flex items-center justify-center gap-2">
                    <Calculator size={18}/> คำนวณด้วย AI
                  </button>
                )}
              </div>
              
              {!showPrediction || !aiAnalysis ? (
                <div className="text-center py-10 bg-black/20 rounded-xl border border-white/5 relative z-10 backdrop-blur-sm">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-3">
                     <Beaker size={32} className="text-purple-400 opacity-70" />
                  </div>
                  <p className="text-purple-200 font-medium">รอการสั่งงาน AI Optimizer...</p>
                </div>
              ) : (
                <div className="space-y-5 relative z-10 animate-fade-in-up">
                  
                  <div className="flex flex-col md:flex-row gap-3">
                     <div className={`flex-1 border p-3 rounded-xl flex items-center justify-between shadow-inner ${aiAnalysis.modelStats.runTopAcc >= 80 ? 'bg-green-500/20 border-green-400/50' : 'bg-white/10 border-white/20'}`}>
                        <div>
                           <p className="text-[10px] text-green-200 font-bold mb-1">✅ สูตรวิ่งบนที่ AI เลือกใช้:</p>
                           <p className="text-sm font-bold text-yellow-300">{aiAnalysis.modelStats.runTopStratName}</p>
                           <p className="text-[10px] text-white mt-1">สถิติความแม่นยำเฉลี่ย</p>
                        </div>
                        <div className={`font-black px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm text-xl ${aiAnalysis.modelStats.runTopAcc >= 80 ? 'bg-green-500 text-white ring-2 ring-yellow-400' : 'bg-white/20 text-white'}`}>
                           {aiAnalysis.modelStats.runTopAcc} <Percent size={16}/>
                        </div>
                     </div>
                     <div className={`flex-1 border p-3 rounded-xl flex items-center justify-between shadow-inner ${aiAnalysis.modelStats.runBotAcc >= 80 ? 'bg-green-500/20 border-green-400/50' : 'bg-white/10 border-white/20'}`}>
                        <div>
                           <p className="text-[10px] text-green-200 font-bold mb-1">✅ สูตรวิ่งล่างที่ AI เลือกใช้:</p>
                           <p className="text-sm font-bold text-yellow-300">{aiAnalysis.modelStats.runBotStratName}</p>
                           <p className="text-[10px] text-white mt-1">สถิติความแม่นยำเฉลี่ย</p>
                        </div>
                        <div className={`font-black px-3 py-2 rounded-lg flex items-center gap-1 shadow-sm text-xl ${aiAnalysis.modelStats.runBotAcc >= 80 ? 'bg-green-500 text-white ring-2 ring-yellow-400' : 'bg-white/20 text-white'}`}>
                           {aiAnalysis.modelStats.runBotAcc} <Percent size={16}/>
                        </div>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="bg-yellow-400/10 border border-yellow-400/30 p-4 rounded-xl text-center shadow-inner">
                      <p className="text-yellow-200 text-sm font-bold mb-2 flex justify-center items-center gap-1"><Target size={16}/> เลขวิ่ง / รูด 19 ประตู</p>
                      <div className="flex flex-col sm:flex-row justify-center items-center gap-2">
                         <div className="bg-black/30 px-3 py-1.5 rounded-lg w-full sm:w-auto">
                           <span className="text-xs text-purple-200 mr-2">บน:</span>
                           <span className="text-xl font-black text-yellow-400">
                             {aiAnalysis.prediction.runningTop[0]}<span className="text-[10px] text-yellow-100 font-normal ml-1 mr-2">(เด่น)</span>
                             {aiAnalysis.prediction.runningTop.length > 1 && `${aiAnalysis.prediction.runningTop[1]}`}
                             {aiAnalysis.prediction.runningTop.length > 1 && <span className="text-[10px] text-yellow-100 font-normal ml-1">(รอง)</span>}
                           </span>
                         </div>
                         <div className="hidden sm:block w-px h-8 bg-white/20"></div>
                         <div className="bg-black/30 px-3 py-1.5 rounded-lg w-full sm:w-auto">
                           <span className="text-xs text-purple-200 mr-2">ล่าง:</span>
                           <span className="text-xl font-black text-yellow-400">
                             {aiAnalysis.prediction.runningBot[0]}<span className="text-[10px] text-yellow-100 font-normal ml-1 mr-2">(เด่น)</span>
                             {aiAnalysis.prediction.runningBot.length > 1 && `${aiAnalysis.prediction.runningBot[1]}`}
                             {aiAnalysis.prediction.runningBot.length > 1 && <span className="text-[10px] text-yellow-100 font-normal ml-1">(รอง)</span>}
                           </span>
                         </div>
                      </div>
                    </div>

                    <div className="bg-gray-800/50 border border-gray-600/50 p-4 rounded-xl text-center shadow-inner">
                      <p className="text-gray-300 text-sm font-bold mb-2 flex justify-center items-center gap-1"><ShieldAlert size={16}/> เลขดับ (คาดว่าไม่ออก)</p>
                      <div className="flex justify-center items-center gap-4">
                         <div><span className="text-xs text-gray-400 mr-2">ดับบน:</span><span className="text-xl font-bold text-gray-200 bg-black/50 px-3 py-1 rounded">{aiAnalysis.prediction.deadTop}</span></div>
                         <div className="w-px h-8 bg-white/10"></div>
                         <div><span className="text-xs text-gray-400 mr-2">ดับล่าง:</span><span className="text-xl font-bold text-gray-200 bg-black/50 px-3 py-1 rounded">{aiAnalysis.prediction.deadBot}</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-1 bg-white/5 p-4 rounded-xl backdrop-blur-md border border-white/10 text-center shadow-inner relative overflow-hidden flex flex-col justify-center">
                      <div className="absolute top-0 left-0 w-full h-1 bg-yellow-400"></div>
                      <p className="text-sm text-purple-300 mb-2 font-medium">ชุดเจาะ 3 ตัวบน (2 หาง)</p>
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {aiAnalysis.prediction.top3.map((num, i) => (
                          <span key={i} className="bg-white/10 px-2 py-1 rounded font-black tracking-wider text-white drop-shadow-md text-xl">{num}</span>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2 grid grid-cols-2 gap-4">
                      <div className="bg-white/5 p-4 rounded-xl backdrop-blur-md border border-white/10 text-center shadow-inner relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-blue-400"></div>
                        <p className="text-sm text-purple-300 mb-2 font-medium">ชุดเจาะ 2 ตัวบน (2 หาง)</p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {aiAnalysis.prediction.top2.map((num, i) => (
                            <span key={i} className="bg-blue-900/40 border border-blue-400/30 px-3 py-1 rounded-lg font-bold tracking-wider text-blue-200 drop-shadow-md text-xl sm:text-2xl">{num}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-white/5 p-4 rounded-xl backdrop-blur-md border border-white/10 text-center shadow-inner relative overflow-hidden flex flex-col justify-center">
                        <div className="absolute top-0 left-0 w-full h-1 bg-red-400"></div>
                        <p className="text-sm text-red-300 mb-2 font-medium">ชุดเจาะ 2 ตัวล่าง (2 หาง)</p>
                        <div className="flex flex-wrap justify-center gap-1.5">
                          {aiAnalysis.prediction.bottom2.map((num, i) => (
                            <span key={i} className="bg-red-900/40 border border-red-400/30 px-3 py-1 rounded-lg font-bold tracking-wider text-red-200 drop-shadow-md text-xl sm:text-2xl">{num}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* History Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden relative z-10 mt-6">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                  <History size={20} className="text-purple-600" />
                  สถิติ และ ผลตรวจย้อนหลัง
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2.5 py-1 rounded-full border border-purple-200">{filteredHistory.length} งวด</span>
                </h2>
                
                {(filteredHistory.length > 0) && (
                   !confirmClear ? (
                     <button onClick={() => setConfirmClear(true)} className="text-xs text-red-500 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 font-medium">
                       <Trash2 size={14}/> ล้างข้อมูล
                     </button>
                   ) : (
                     <div className="flex items-center gap-2 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">
                       <span className="text-xs text-red-700 font-bold mr-1">ยืนยันลบ?</span>
                       <button onClick={handleClearAll} className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 font-medium">ลบ</button>
                       <button onClick={() => setConfirmClear(false)} className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded hover:bg-gray-300 font-medium">ยกเลิก</button>
                     </div>
                   )
                )}
              </div>
              
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-white text-gray-500 text-xs uppercase sticky top-0 shadow-sm z-0">
                    <tr>
                      <th className="px-3 py-3 font-bold whitespace-nowrap">งวดวันที่</th>
                      <th className="px-3 py-3 text-center text-blue-600 font-bold whitespace-nowrap">3 บน / 2 บน</th>
                      <th className="px-3 py-3 text-center text-red-600 font-bold whitespace-nowrap">2 ล่าง</th>
                      <th className="px-3 py-3 font-bold text-purple-700 min-w-[280px]">ผลตรวจสูตร</th>
                      <th className="px-3 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredHistory.length === 0 ? (
                      <tr><td colSpan="5" className="px-4 py-16 text-center text-gray-400"><p>ไม่พบสถิติ</p></td></tr>
                    ) : (
                      filteredHistory.map((entry, index) => {
                        const ev = aiAnalysis?.historyEvals?.[entry.id];
                        return (
                          <tr key={entry.id} className="hover:bg-purple-50/50 transition-colors group">
                            <td className="px-3 py-3 font-bold text-gray-800">{entry.date}</td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-bold text-blue-700 bg-blue-100 border border-blue-200 px-2 py-1 rounded">{entry.top3}</span>
                              <span className="text-gray-300 mx-1">/</span>
                              <span className="font-semibold text-gray-600">{entry.top2}</span>
                            </td>
                            <td className="px-3 py-3 text-center"><span className="font-bold text-red-700 bg-red-100 border border-red-200 px-2 py-1 rounded">{entry.bottom2}</span></td>
                            <td className="px-3 py-3">
                              {ev ? (
                                <div className="flex flex-col gap-1.5">
                                  <div className="text-[11px] text-gray-700 bg-white px-2 py-1.5 rounded border border-gray-200 shadow-sm flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-purple-700 flex items-center gap-0.5"><Calculator size={12} /> ให้:</span> 
                                    <div><span className="text-gray-500">วิ่งบน</span> <span className="font-bold text-orange-500">{ev.uniquePredRunTop.join(', ')}</span></div>
                                    <div className="w-px h-3 bg-gray-300"></div>
                                    <div><span className="text-gray-500">วิ่งล่าง</span> <span className="font-bold text-orange-500">{ev.uniquePredRunBot.join(', ')}</span></div>
                                    <div className="w-px h-3 bg-gray-300"></div>
                                    <div className="flex gap-1 flex-wrap"><span className="text-gray-500">เจาะบน</span> <span className="font-bold text-blue-700">{ev.predTop2.join(', ')}</span></div>
                                    <div className="w-px h-3 bg-gray-300"></div>
                                    <div className="flex gap-1 flex-wrap"><span className="text-gray-500">เจาะล่าง</span> <span className="font-bold text-red-600">{ev.predBot2.join(', ')}</span></div>
                                  </div>
                                  
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {ev.runTopHits.length > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-1.5 py-0.5 rounded font-bold shadow-sm">🏃 วิ่งบน({ev.runTopHits.join(', ')})</span>}
                                    {ev.runBotHits.length > 0 && <span className="text-[10px] bg-yellow-100 text-yellow-800 border border-yellow-300 px-1.5 py-0.5 rounded font-bold shadow-sm">🏃 วิ่งล่าง({ev.runBotHits.join(', ')})</span>}
                                    {ev.isTop3Exact && <span className="text-[10px] bg-green-100 text-green-800 border border-green-300 px-1.5 py-0.5 rounded font-bold shadow-sm">🎯 3บนตรง</span>}
                                    {ev.isTop2Exact && <span className="text-[10px] bg-green-100 text-green-800 border border-green-300 px-1.5 py-0.5 rounded font-bold shadow-sm">🔥 2บน(ตรง)</span>}
                                    {ev.isTop2Toad && !ev.isTop2Exact && <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.5 rounded font-bold shadow-sm">🔥 2บน(กลับ)</span>}
                                    {ev.isBot2Exact && <span className="text-[10px] bg-green-100 text-green-800 border border-green-300 px-1.5 py-0.5 rounded font-bold shadow-sm">🔥 2ล่าง(ตรง)</span>}
                                    {ev.isBot2Toad && !ev.isBot2Exact && <span className="text-[10px] bg-blue-100 text-blue-800 border border-blue-300 px-1.5 py-0.5 rounded font-bold shadow-sm">🔥 2ล่าง(กลับ)</span>}
                                    
                                    {ev.isDeadTopPass ? 
                                      <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-300 px-1.5 py-0.5 rounded shadow-sm">🛡️ ดับบน({ev.predDeadTop}) ผ่าน</span> : 
                                      <span className="text-[10px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded line-through shadow-sm">ดับบน({ev.predDeadTop}) หลุด</span>
                                    }
                                    {ev.isDeadBotPass ? 
                                      <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-300 px-1.5 py-0.5 rounded shadow-sm">🛡️ ดับล่าง({ev.predDeadBot}) ผ่าน</span> : 
                                      <span className="text-[10px] bg-red-50 text-red-500 border border-red-200 px-1.5 py-0.5 rounded line-through shadow-sm">ดับล่าง({ev.predDeadBot}) หลุด</span>
                                    }

                                    {!ev.isTop3Exact && !ev.isTop2Exact && !ev.isTop2Toad && !ev.isBot2Exact && !ev.isBot2Toad && ev.runTopHits.length === 0 && ev.runBotHits.length === 0 && (<span className="text-[10px] text-gray-400 border border-transparent px-1.5 py-0.5">เจาะ/วิ่ง หลุด</span>)}
                                  </div>
                                </div>
                              ) : <span className="text-[10px] text-gray-400">ไม่มีสถิติย้อนหลังพอให้คำนวณ</span>}
                            </td>
                            <td className="px-2 py-3 text-right">
                              <button onClick={() => deleteEntry(entry.id, mode === 'bimonthly' ? 'bi' : 'daily')} className="text-gray-300 hover:text-red-500 p-1.5 bg-white rounded-md border border-transparent hover:border-red-200 hover:bg-red-50 transition-all">
                                <Trash2 size={16} />
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