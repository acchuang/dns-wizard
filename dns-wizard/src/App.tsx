import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Gauge, Shield, Gamepad2, UserCheck, Zap, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PROFILES = [
  { id: 'Balanced', name: 'Balanced', icon: <Zap />, desc: 'Best overall speed' },
  { id: 'Gamer', name: 'Gamer', icon: <Gamepad2 />, desc: 'Lowest latency' },
  { id: 'Parent', name: 'Family', icon: <UserCheck />, desc: 'Safe browsing' },
  { id: 'Privacy', name: 'Privacy', icon: <Shield />, desc: 'Hide your habits' },
  { id: 'AdBlock', name: 'Ad-Free', icon: <Gauge />, desc: 'Block annoying ads' },
];

export default function App() {
  const [step, setStep] = useState(1);
  const [selectedProfile, setSelectedProfile] = useState('Balanced');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ type: '', msg: '' });

  async function startBenchmark() {
    setLoading(true);
    setStep(2);
    try {
      const data = await invoke('run_benchmark', { profile: selectedProfile });
      setResults(data);
    } catch (e) {
      setStatus({ type: 'error', msg: 'Benchmark failed!' });
    } finally {
      setLoading(false);
    }
  }

  async function applyBest() {
    if (results.length === 0) return;
    const primary = results[0].ip;
    const secondary = results[1]?.ip || results[0].ip;
    
    setStatus({ type: 'info', msg: 'Optimizing your network...' });
    try {
      const res = await invoke('apply_dns', { primary, secondary });
      setStatus({ type: res.success ? 'success' : 'error', msg: res.message });
      if (res.success) setStep(3);
    } catch (e) {
      setStatus({ type: 'error', msg: 'System error occurred.' });
    }
  }

  return (
    <div className="app-container">
      <header>
        <h1>DNS Wizard</h1>
        <p>Make your internet feel like new.</p>
      </header>

      <main>
        {step === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid">
            {PROFILES.map(p => (
              <div 
                key={p.id} 
                className={`card ${selectedProfile === p.id ? 'active' : ''}`} 
                onClick={() => setSelectedProfile(p.id)}
              >
                <div className="icon">{p.icon}</div>
                <h3>{p.name}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
            <button className="btn-primary" onClick={startBenchmark}>Optimize Now</button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="benchmark-view">
            {loading ? (
              <div className="loader">
                <Zap className="spin" />
                <p>Testing servers near you...</p>
              </div>
            ) : (
              <div className="results">
                <h2>Fastest Servers for {selectedProfile}</h2>
                {results.map((r, i) => (
                  <div key={r.ip} className="res-row">
                    <span>{i + 1}. {r.name}</span>
                    <span className="latency">{r.latency}ms</span>
                  </div>
                ))}
                <button className="btn-primary" onClick={applyBest}>Use Fastest Server</button>
                <button className="btn-link" onClick={() => setStep(1)}>Change Profile</button>
              </div>
            )}
            {status.msg && <div className={`status ${status.type}`}>{status.msg}</div>}
          </motion.div>
        )}

        {step === 3 && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="success-view">
            <CheckCircle2 size={64} color="#4CAF50" />
            <h2>Your Network is Optimized!</h2>
            <p>We've configured your system to use the fastest possible DNS servers.</p>
            <button className="btn-secondary" onClick={() => setStep(1)}>Back Home</button>
          </motion.div>
        )}
      </main>

      <style>{`
        .app-container { font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 2rem; text-align: center; color: #333; }
        header { margin-bottom: 3rem; }
        header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; color: #1a1a1a; }
        header p { color: #666; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; }
        .card { padding: 1.5rem; border: 2px solid #eee; border-radius: 16px; cursor: pointer; transition: all 0.2s; }
        .card.active { border-color: #007AFF; background: #F0F7FF; }
        .card .icon { margin-bottom: 1rem; color: #007AFF; }
        .btn-primary { background: #007AFF; color: white; border: none; padding: 1rem 2rem; border-radius: 12px; font-weight: bold; cursor: pointer; margin-top: 2rem; width: 100%; transition: opacity 0.2s; }
        .btn-primary:hover { opacity: 0.9; }
        .btn-secondary { background: #eee; border: none; padding: 1rem 2rem; border-radius: 12px; cursor: pointer; margin-top: 1rem; }
        .btn-link { background: none; border: none; color: #666; cursor: pointer; margin-top: 1rem; text-decoration: underline; }
        .benchmark-view { padding: 2rem; background: #f9f9f9; border-radius: 24px; }
        .res-row { display: flex; justify-content: space-between; padding: 1rem; border-bottom: 1px solid #eee; }
        .latency { font-weight: bold; color: #007AFF; }
        .loader { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .spin { animation: spin 2s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .status { margin-top: 1rem; padding: 1rem; border-radius: 8px; font-size: 0.9rem; }
        .status.info { background: #e1f5fe; color: #0288d1; }
        .status.success { background: #e8f5e9; color: #2e7d32; }
        .status.error { background: #ffebee; color: #c62828; }
        .success-view { display: flex; flex-direction: column; align-items: center; gap: 1rem; padding: 3rem; }
      `}</style>
    </div>
  );
}
