import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import {
  Wallet, Plus, X, Utensils, Car, Zap, Film, Shirt, Heart,
  GraduationCap, MoreHorizontal, Banknote, Gift, Sparkles,
  TrendingUp, TrendingDown, Trash2, ArrowUpRight, ArrowDownRight, Check,
} from "lucide-react";

const EXPENSE_CATS = [
  { id: "food", label: "Oziq-ovqat", icon: Utensils, color: "#FF6B5C" },
  { id: "transport", label: "Transport", icon: Car, color: "#E8B84B" },
  { id: "utilities", label: "Kommunal", icon: Zap, color: "#4EA8DE" },
  { id: "fun", label: "Ko'ngilochar", icon: Film, color: "#C77DFF" },
  { id: "clothes", label: "Kiyim-kechak", icon: Shirt, color: "#FF8FAB" },
  { id: "health", label: "Sog'liq", icon: Heart, color: "#5FD9A5" },
  { id: "education", label: "Ta'lim", icon: GraduationCap, color: "#FFB562" },
  { id: "other_exp", label: "Boshqa", icon: MoreHorizontal, color: "#9CA3AF" },
];

const INCOME_CATS = [
  { id: "salary", label: "Oylik", icon: Banknote, color: "#5FD9A5" },
  { id: "bonus", label: "Bonus", icon: Sparkles, color: "#E8B84B" },
  { id: "gift", label: "Sovg'a", icon: Gift, color: "#FF8FAB" },
  { id: "other_inc", label: "Boshqa", icon: MoreHorizontal, color: "#4EA8DE" },
];

const ALL_CATS = [...EXPENSE_CATS, ...INCOME_CATS];
const catById = (id) => ALL_CATS.find((c) => c.id === id) || EXPENSE_CATS[7];

function formatSom(n) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.round(Math.abs(n)).toString();
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${sign}${grouped} so'm`;
}

const MONTHS_UZ = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
const WEEKDAYS_UZ = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];

function dayLabel(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  if (sameDay(d, today)) return "Bugun";
  if (sameDay(d, yesterday)) return "Kecha";
  return `${d.getDate()} ${MONTHS_UZ[d.getMonth()]}, ${WEEKDAYS_UZ[d.getDay()]}`;
}

function todayStr() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function Hamyon() {
  const [transactions, setTransactions] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [formType, setFormType] = useState("expense");
  const [formAmount, setFormAmount] = useState("");
  const [formCat, setFormCat] = useState(EXPENSE_CATS[0].id);
  const [formNote, setFormNote] = useState("");
  const [formDate, setFormDate] = useState(todayStr());
  const [saveError, setSaveError] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [balancePulse, setBalancePulse] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("transactions-v1");
        if (res && res.value) setTransactions(JSON.parse(res.value));
      } catch (e) {
        // no data yet
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next) => {
    setTransactions(next);
    try {
      const res = await window.storage.set("transactions-v1", JSON.stringify(next));
      setSaveError(!res);
    } catch (e) {
      setSaveError(true);
    }
  }, []);

  const totals = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of transactions) {
      if (t.type === "income") income += t.amount;
      else expense += t.amount;
    }
    return { income, expense, balance: income - expense };
  }, [transactions]);

  const expenseByCategory = useMemo(() => {
    const now = new Date();
    const map = {};
    for (const t of transactions) {
      if (t.type !== "expense") continue;
      const d = new Date(t.date + "T00:00:00");
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) continue;
      map[t.category] = (map[t.category] || 0) + t.amount;
    }
    return Object.entries(map)
      .map(([id, value]) => ({ id, name: catById(id).label, value, color: catById(id).color }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  const monthlyTrend = useMemo(() => {
    const now = new Date();
    const buckets = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTHS_UZ[d.getMonth()], income: 0, expense: 0 });
    }
    const byKey = Object.fromEntries(buckets.map((b) => [b.key, b]));
    for (const t of transactions) {
      const d = new Date(t.date + "T00:00:00");
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (byKey[key]) byKey[key][t.type] += t.amount;
    }
    return buckets;
  }, [transactions]);

  const grouped = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
    const map = new Map();
    for (const t of sorted) {
      if (!map.has(t.date)) map.set(t.date, []);
      map.get(t.date).push(t);
    }
    return Array.from(map.entries());
  }, [transactions]);

  function openSheet(type) {
    setFormType(type);
    setFormCat(type === "expense" ? EXPENSE_CATS[0].id : INCOME_CATS[0].id);
    setFormAmount("");
    setFormNote("");
    setFormDate(todayStr());
    setSheetOpen(true);
  }

  function submitForm() {
    const amount = parseFloat(formAmount.replace(/[^0-9.]/g, ""));
    if (!amount || amount <= 0) return;
    const t = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type: formType,
      amount,
      category: formCat,
      note: formNote.trim(),
      date: formDate,
      createdAt: Date.now(),
    };
    persist([t, ...transactions]);
    setSheetOpen(false);
    setConfirmation({ type: formType, amount, catLabel: catById(formCat).label });
    setBalancePulse(true);
  }

  useEffect(() => {
    if (!confirmation) return;
    const timer = setTimeout(() => setConfirmation(null), 1500);
    return () => clearTimeout(timer);
  }, [confirmation]);

  useEffect(() => {
    if (!balancePulse) return;
    const timer = setTimeout(() => setBalancePulse(false), 700);
    return () => clearTimeout(timer);
  }, [balancePulse]);

  function removeTransaction(id) {
    persist(transactions.filter((t) => t.id !== id));
  }

  const cats = formType === "expense" ? EXPENSE_CATS : INCOME_CATS;
  const maxExpense = expenseByCategory[0]?.value || 1;

  return (
    <div className="hm-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

        .hm-root {
          --bg: #0B1F17;
          --surface: #13291F;
          --surface-2: #17301F;
          --edge: #24422F;
          --ink: #F0EDE4;
          --ink-dim: #9FB3A6;
          --mint: #5FD9A5;
          --coral: #FF6B5C;
          --gold: #E8B84B;
          font-family: 'Manrope', sans-serif;
          background: radial-gradient(1200px 800px at 50% -10%, #163728 0%, var(--bg) 55%);
          color: var(--ink);
          min-height: 100vh;
          padding: 28px 16px 100px;
          box-sizing: border-box;
        }
        .hm-root * { box-sizing: border-box; }
        .hm-wrap { max-width: 480px; margin: 0 auto; }

        .hm-header { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
        .hm-header .icon { width: 34px; height: 34px; border-radius: 10px; background: linear-gradient(135deg, var(--mint), #2f8f68); display: flex; align-items: center; justify-content: center; flex-shrink:0; }
        .hm-header h1 { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; margin: 0; letter-spacing: 0.2px; }
        .hm-header p { margin: 0; font-size: 12px; color: var(--ink-dim); }

        /* Ticket-stub balance card */
        .hm-card {
          position: relative;
          background: linear-gradient(160deg, var(--surface-2), var(--surface));
          border: 1px solid var(--edge);
          border-radius: 22px;
          padding: 26px 24px 0;
          overflow: visible;
          box-shadow: 0 20px 40px -20px rgba(0,0,0,0.6);
        }
        .hm-card::before, .hm-card::after {
          content: ""; position: absolute; width: 22px; height: 22px; background: var(--bg);
          border-radius: 50%; top: 143px;
        }
        .hm-card::before { left: -11px; }
        .hm-card::after { right: -11px; }
        .hm-balance-label { font-size: 12px; color: var(--ink-dim); letter-spacing: 0.08em; text-transform: uppercase; margin: 0 0 6px; }
        .hm-balance { font-family: 'Fraunces', serif; font-size: 38px; font-weight: 600; margin: 0; line-height: 1.05; word-break: break-word; }
        .hm-perf {
          margin: 22px 0 0;
          border: none;
          border-top: 2px dashed var(--edge);
          height: 0;
        }
        .hm-stats { display: flex; padding: 16px 0 20px; gap: 10px; }
        .hm-stat { flex: 1; display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,0.02); }
        .hm-stat .dot { width: 30px; height: 30px; border-radius: 9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .hm-stat .dot.in { background: rgba(95,217,165,0.14); color: var(--mint); }
        .hm-stat .dot.out { background: rgba(255,107,92,0.14); color: var(--coral); }
        .hm-stat .lbl { font-size: 10.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; }
        .hm-stat .val { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; }

        .hm-actions { display: flex; gap: 10px; margin: 20px 0 26px; }
        .hm-btn { flex: 1; display:flex; align-items:center; justify-content:center; gap:8px; padding: 13px; border-radius: 14px; border: none; font-family:'Manrope'; font-weight: 700; font-size: 14px; cursor: pointer; transition: transform .15s ease, filter .15s ease; }
        .hm-btn:active { transform: scale(0.97); }
        .hm-btn.in { background: linear-gradient(135deg, var(--mint), #2f8f68); color: #06170F; }
        .hm-btn.out { background: linear-gradient(135deg, var(--coral), #b8382b); color: #1a0605; }
        .hm-btn:hover { filter: brightness(1.08); }

        .hm-section-title { font-family:'Fraunces', serif; font-size: 16px; font-weight: 600; margin: 0 0 12px; display:flex; align-items:center; justify-content:space-between; }
        .hm-section { background: var(--surface); border: 1px solid var(--edge); border-radius: 18px; padding: 18px; margin-bottom: 16px; }

        .hm-legend { display:flex; flex-direction:column; gap:9px; margin-top: 8px; }
        .hm-legend-row { display:flex; align-items:center; gap:9px; font-size: 13px; }
        .hm-legend-row .sw { width: 9px; height: 9px; border-radius: 3px; flex-shrink:0; }
        .hm-legend-row .name { flex:1; color: var(--ink-dim); }
        .hm-legend-row .amt { font-family:'JetBrains Mono', monospace; font-size: 12.5px; }
        .hm-bar-track { height: 5px; border-radius: 3px; background: rgba(255,255,255,0.06); overflow:hidden; margin-top: 3px; }
        .hm-bar-fill { height: 100%; border-radius: 3px; }

        .hm-empty { text-align:center; padding: 22px 10px; color: var(--ink-dim); font-size: 13px; }
        .hm-empty svg { opacity: 0.5; margin-bottom: 8px; }

        .hm-tx-day { font-size: 11.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; margin: 18px 0 8px 4px; }
        .hm-tx-day:first-child { margin-top: 0; }
        .hm-tx { display:flex; align-items:center; gap: 12px; padding: 11px 4px; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .hm-tx:last-child { border-bottom: none; }
        .hm-tx .ic { width: 38px; height: 38px; border-radius: 12px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .hm-tx .body { flex: 1; min-width: 0; }
        .hm-tx .name { font-size: 14px; font-weight: 600; margin:0; }
        .hm-tx .note { font-size: 12px; color: var(--ink-dim); margin: 1px 0 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .hm-tx .amt { font-family:'JetBrains Mono', monospace; font-size: 13.5px; font-weight: 600; flex-shrink:0; }
        .hm-tx .amt.in { color: var(--mint); }
        .hm-tx .amt.out { color: var(--coral); }
        .hm-tx .del { background:none; border:none; color: var(--ink-dim); opacity:0; cursor:pointer; padding: 4px; flex-shrink:0; transition: opacity .15s; }
        .hm-tx:hover .del { opacity: 0.7; }
        .hm-tx .del:hover { color: var(--coral); opacity:1; }

        .hm-sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.55); backdrop-filter: blur(2px); z-index: 50; display:flex; align-items:flex-end; justify-content:center; animation: hm-fade .18s ease; }
        @keyframes hm-fade { from { opacity: 0 } to { opacity: 1 } }
        .hm-sheet { width: 100%; max-width: 480px; background: var(--surface-2); border: 1px solid var(--edge); border-bottom: none; border-radius: 22px 22px 0 0; padding: 18px 18px 26px; animation: hm-up .22s cubic-bezier(.2,.8,.3,1); max-height: 88vh; overflow-y: auto; }
        @keyframes hm-up { from { transform: translateY(24px); opacity:0 } to { transform: translateY(0); opacity:1 } }
        .hm-sheet-head { display:flex; align-items:center; justify-content:space-between; margin-bottom: 16px; }
        .hm-sheet-head h3 { font-family:'Fraunces', serif; font-size: 18px; margin:0; }
        .hm-sheet-head button { background: rgba(255,255,255,0.06); border:none; color: var(--ink); width: 30px; height:30px; border-radius: 9px; display:flex; align-items:center; justify-content:center; cursor:pointer; }

        .hm-tabs { display:flex; background: rgba(255,255,255,0.04); border-radius: 12px; padding: 4px; margin-bottom: 16px; }
        .hm-tab { flex:1; text-align:center; padding: 9px; border-radius: 9px; font-size: 13px; font-weight: 700; cursor:pointer; border:none; background:none; color: var(--ink-dim); transition: all .15s; }
        .hm-tab.active.in { background: var(--mint); color: #06170F; }
        .hm-tab.active.out { background: var(--coral); color: #1a0605; }

        .hm-field { margin-bottom: 14px; }
        .hm-field label { display:block; font-size: 11.5px; color: var(--ink-dim); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
        .hm-amount-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--edge); border-radius: 12px; padding: 14px; font-family:'JetBrains Mono', monospace; font-size: 22px; font-weight: 600; color: var(--ink); outline: none; }
        .hm-amount-input:focus { border-color: var(--mint); }
        .hm-text-input { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid var(--edge); border-radius: 12px; padding: 11px 13px; font-family:'Manrope'; font-size: 14px; color: var(--ink); outline: none; }
        .hm-text-input:focus { border-color: var(--mint); }

        .hm-cat-grid { display:grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .hm-cat-btn { display:flex; flex-direction:column; align-items:center; gap: 6px; background: rgba(255,255,255,0.03); border: 1.5px solid transparent; border-radius: 13px; padding: 10px 4px; cursor: pointer; transition: all .15s; }
        .hm-cat-btn .ic { width: 32px; height: 32px; border-radius: 10px; display:flex; align-items:center; justify-content:center; }
        .hm-cat-btn span { font-size: 10.5px; color: var(--ink-dim); text-align:center; line-height:1.15; }
        .hm-cat-btn.sel { border-color: var(--mint); background: rgba(95,217,165,0.08); }
        .hm-cat-btn.sel span { color: var(--ink); }

        .hm-save-btn { width: 100%; padding: 15px; border-radius: 13px; border: none; font-weight: 800; font-size: 15px; margin-top: 6px; cursor: pointer; }
        .hm-save-btn.in { background: linear-gradient(135deg, var(--mint), #2f8f68); color: #06170F; }
        .hm-save-btn.out { background: linear-gradient(135deg, var(--coral), #b8382b); color: #1a0605; }
        .hm-save-btn:disabled { opacity: 0.4; cursor: not-allowed; }

        .hm-warn { font-size: 11px; color: var(--gold); text-align:center; margin-top: 10px; }

        .hm-chart-tip { background: var(--surface-2); border: 1px solid var(--edge); border-radius: 10px; padding: 8px 11px; font-size: 12px; }

        /* Entrance choreography */
        @keyframes hm-rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .hm-anim { opacity: 0; animation: hm-rise .55s cubic-bezier(.16,.9,.35,1) forwards; }
        .hm-d0 { animation-delay: .02s; }
        .hm-d1 { animation-delay: .10s; }
        .hm-d2 { animation-delay: .18s; }
        .hm-d3 { animation-delay: .26s; }
        .hm-d4 { animation-delay: .34s; }

        @keyframes hm-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(95,217,165,0.45); }
          100% { box-shadow: 0 0 0 14px rgba(95,217,165,0); }
        }
        .hm-card.pulse { animation: hm-pulse-ring .7s ease-out; }

        .hm-tx { animation: hm-rise .4s ease forwards; }

        .hm-btn.in, .hm-btn.out { position: relative; overflow: hidden; }
        .hm-btn::after {
          content: ""; position: absolute; inset: 0; border-radius: inherit;
          background: radial-gradient(circle, rgba(255,255,255,0.35) 0%, transparent 60%);
          opacity: 0; transform: scale(0.4);
          transition: opacity .5s ease, transform .5s ease;
        }
        .hm-btn:active::after { opacity: 1; transform: scale(1.4); transition: 0s; }

        .hm-cat-btn { position: relative; }
        .hm-cat-btn.sel .ic { animation: hm-pop .35s cubic-bezier(.3,1.5,.4,1); }
        @keyframes hm-pop { 0% { transform: scale(0.7); } 60% { transform: scale(1.18); } 100% { transform: scale(1); } }

        /* Success confirmation overlay */
        .hm-confirm-backdrop {
          position: fixed; inset: 0; z-index: 80;
          display: flex; align-items: center; justify-content: center;
          background: rgba(6, 15, 11, 0.72);
          backdrop-filter: blur(6px);
          animation: hm-confirm-fade .25s ease forwards;
        }
        @keyframes hm-confirm-fade { from { opacity: 0; } to { opacity: 1; } }
        .hm-confirm-fade-out { animation: hm-confirm-fadeout .3s ease forwards; }
        @keyframes hm-confirm-fadeout { from { opacity: 1; } to { opacity: 0; } }

        .hm-confirm-card { display: flex; flex-direction: column; align-items: center; gap: 16px; }

        .hm-confirm-ring {
          position: relative;
          width: 128px; height: 128px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          animation: hm-ring-pop .55s cubic-bezier(.2,1.6,.4,1) forwards;
        }
        .hm-confirm-ring.in { background: linear-gradient(150deg, var(--mint), #2f8f68); box-shadow: 0 0 0 0 rgba(95,217,165,0.5); }
        .hm-confirm-ring.out { background: linear-gradient(150deg, var(--coral), #b8382b); box-shadow: 0 0 0 0 rgba(255,107,92,0.5); }
        @keyframes hm-ring-pop {
          0% { transform: scale(0.3); opacity: 0; }
          55% { transform: scale(1.12); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .hm-confirm-ring::before, .hm-confirm-ring::after {
          content: ""; position: absolute; inset: 0; border-radius: 50%;
          border: 2px solid currentColor; opacity: 0;
          animation: hm-ripple 1s ease-out forwards;
        }
        .hm-confirm-ring.in::before, .hm-confirm-ring.in::after { color: var(--mint); }
        .hm-confirm-ring.out::before, .hm-confirm-ring.out::after { color: var(--coral); }
        .hm-confirm-ring::after { animation-delay: .18s; }
        @keyframes hm-ripple {
          0% { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        .hm-confirm-check {
          stroke-dasharray: 40; stroke-dashoffset: 40;
          animation: hm-draw .45s .25s ease forwards;
        }
        @keyframes hm-draw { to { stroke-dashoffset: 0; } }

        .hm-confirm-text { text-align: center; animation: hm-rise .4s .3s ease backwards; }
        .hm-confirm-title { font-family: 'Fraunces', serif; font-size: 20px; font-weight: 600; margin: 0 0 4px; }
        .hm-confirm-amount { font-family: 'JetBrains Mono', monospace; font-size: 26px; font-weight: 700; margin: 0; }
        .hm-confirm-amount.in { color: var(--mint); }
        .hm-confirm-amount.out { color: var(--coral); }
        .hm-confirm-sub { font-size: 12.5px; color: var(--ink-dim); margin: 4px 0 0; }
      `}</style>

      <div className="hm-wrap">
        <div className="hm-header hm-anim hm-d0">
          <div className="icon"><Wallet size={18} color="#06170F" /></div>
          <div>
            <h1>Hamyon</h1>
            <p>shaxsiy xarajatlar kundaligi</p>
          </div>
        </div>

        <div className={`hm-card hm-anim hm-d1 ${balancePulse ? "pulse" : ""}`}>
          <p className="hm-balance-label">Joriy balans</p>
          <p className="hm-balance">{loaded ? formatSom(totals.balance) : "…"}</p>
          <hr className="hm-perf" />
          <div className="hm-stats">
            <div className="hm-stat">
              <div className="dot in"><TrendingUp size={15} /></div>
              <div>
                <div className="lbl">Kirim</div>
                <div className="val">{formatSom(totals.income)}</div>
              </div>
            </div>
            <div className="hm-stat">
              <div className="dot out"><TrendingDown size={15} /></div>
              <div>
                <div className="lbl">Chiqim</div>
                <div className="val">{formatSom(totals.expense)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="hm-actions hm-anim hm-d2">
          <button className="hm-btn in" onClick={() => openSheet("income")}>
            <ArrowDownRight size={17} /> Pul tushdi
          </button>
          <button className="hm-btn out" onClick={() => openSheet("expense")}>
            <ArrowUpRight size={17} /> Xarajat
          </button>
        </div>

        <div className="hm-section hm-anim hm-d3">
          <h2 className="hm-section-title">Shu oy — kategoriyalar</h2>
          {expenseByCategory.length === 0 ? (
            <div className="hm-empty">
              <div>Bu oyda xarajat qayd etilmagan</div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie
                    data={expenseByCategory}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {expenseByCategory.map((e) => (
                      <Cell key={e.id} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    content={({ active, payload }) =>
                      active && payload && payload.length ? (
                        <div className="hm-chart-tip">
                          {payload[0].name}: {formatSom(payload[0].value)}
                        </div>
                      ) : null
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="hm-legend">
                {expenseByCategory.map((e) => (
                  <div key={e.id} className="hm-legend-row">
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span className="sw" style={{ background: e.color }} />
                        <span className="name">{e.name}</span>
                        <span className="amt">{formatSom(e.value)}</span>
                      </div>
                      <div className="hm-bar-track">
                        <div className="hm-bar-fill" style={{ width: `${(e.value / maxExpense) * 100}%`, background: e.color }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="hm-section hm-anim hm-d4">
          <h2 className="hm-section-title">Oxirgi 6 oy</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={monthlyTrend} barGap={3}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1E3A2A" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: "#9FB3A6", fontSize: 11 }} axisLine={{ stroke: "#24422F" }} tickLine={false} />
              <YAxis hide />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload && payload.length ? (
                    <div className="hm-chart-tip">
                      <div style={{ marginBottom: 4, color: "#9FB3A6" }}>{label}</div>
                      <div style={{ color: "#5FD9A5" }}>Kirim: {formatSom(payload.find(p => p.dataKey === "income")?.value || 0)}</div>
                      <div style={{ color: "#FF6B5C" }}>Chiqim: {formatSom(payload.find(p => p.dataKey === "expense")?.value || 0)}</div>
                    </div>
                  ) : null
                }
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="income" fill="#5FD9A5" radius={[4, 4, 0, 0]} maxBarSize={14} />
              <Bar dataKey="expense" fill="#FF6B5C" radius={[4, 4, 0, 0]} maxBarSize={14} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="hm-section">
          <h2 className="hm-section-title">Tranzaksiyalar</h2>
          {!loaded ? (
            <div className="hm-empty">Yuklanmoqda…</div>
          ) : transactions.length === 0 ? (
            <div className="hm-empty">
              <Wallet size={28} />
              <div>Hali tranzaksiya yo'q.<br />Yuqoridagi tugmalar orqali qo'shing.</div>
            </div>
          ) : (
            grouped.map(([date, items]) => (
              <div key={date}>
                <div className="hm-tx-day">{dayLabel(date)}</div>
                {items.map((t) => {
                  const cat = catById(t.category);
                  const Icon = cat.icon;
                  return (
                    <div className="hm-tx" key={t.id} style={{ animationDelay: "0s" }}>
                      <div className="ic" style={{ background: `${cat.color}22`, color: cat.color }}>
                        <Icon size={17} />
                      </div>
                      <div className="body">
                        <p className="name">{cat.label}</p>
                        {t.note && <p className="note">{t.note}</p>}
                      </div>
                      <div className={`amt ${t.type === "income" ? "in" : "out"}`}>
                        {t.type === "income" ? "+" : "−"}{formatSom(t.amount)}
                      </div>
                      <button className="del" onClick={() => removeTransaction(t.id)} aria-label="O'chirish">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {sheetOpen && (
        <div className="hm-sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <div className="hm-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="hm-sheet-head">
              <h3>Yangi tranzaksiya</h3>
              <button onClick={() => setSheetOpen(false)}><X size={16} /></button>
            </div>

            <div className="hm-tabs">
              <button
                className={`hm-tab ${formType === "income" ? "active in" : ""}`}
                onClick={() => { setFormType("income"); setFormCat(INCOME_CATS[0].id); }}
              >
                Kirim
              </button>
              <button
                className={`hm-tab ${formType === "expense" ? "active out" : ""}`}
                onClick={() => { setFormType("expense"); setFormCat(EXPENSE_CATS[0].id); }}
              >
                Chiqim
              </button>
            </div>

            <div className="hm-field">
              <label>Summa (so'm)</label>
              <input
                className="hm-amount-input"
                inputMode="numeric"
                placeholder="0"
                value={formAmount}
                onChange={(e) => setFormAmount(e.target.value)}
                autoFocus
              />
            </div>

            <div className="hm-field">
              <label>Kategoriya</label>
              <div className="hm-cat-grid">
                {cats.map((c) => {
                  const Icon = c.icon;
                  return (
                    <button
                      key={c.id}
                      className={`hm-cat-btn ${formCat === c.id ? "sel" : ""}`}
                      onClick={() => setFormCat(c.id)}
                      type="button"
                    >
                      <div className="ic" style={{ background: `${c.color}22`, color: c.color }}>
                        <Icon size={16} />
                      </div>
                      <span>{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="hm-field">
              <label>Sana</label>
              <input
                className="hm-text-input"
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                max={todayStr()}
              />
            </div>

            <div className="hm-field">
              <label>Izoh (ixtiyoriy)</label>
              <input
                className="hm-text-input"
                placeholder="Masalan: bozor, taksi..."
                value={formNote}
                onChange={(e) => setFormNote(e.target.value)}
              />
            </div>

            <button
              className={`hm-save-btn ${formType === "income" ? "in" : "out"}`}
              onClick={submitForm}
              disabled={!formAmount || parseFloat(formAmount) <= 0}
            >
              Saqlash
            </button>
            {saveError && <div className="hm-warn">Saqlashda muammo — internet aloqasini tekshiring.</div>}
          </div>
        </div>
      )}

      {confirmation && (
        <div className="hm-confirm-backdrop">
          <div className="hm-confirm-card">
            <div className={`hm-confirm-ring ${confirmation.type === "income" ? "in" : "out"}`}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none">
                <path
                  className="hm-confirm-check"
                  d="M5 12.5L10 17.5L19 7"
                  stroke={confirmation.type === "income" ? "#06170F" : "#1a0605"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="hm-confirm-text">
              <p className="hm-confirm-title">Tasdiqlandi!</p>
              <p className={`hm-confirm-amount ${confirmation.type === "income" ? "in" : "out"}`}>
                {confirmation.type === "income" ? "+" : "−"}{formatSom(confirmation.amount)}
              </p>
              <p className="hm-confirm-sub">{confirmation.catLabel} kategoriyasiga qo'shildi</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
