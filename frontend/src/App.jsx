import React, { useState, useEffect, useRef } from 'react';
import { Play, Calendar, Download, Loader2, Image as ImageIcon, ScrollText, Zap, Sparkles, Copy, Check, ChevronDown, ChevronUp, Square, RotateCcw, FileText, Clock, Film } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Convert "2026-02-11" to "2月11日" format
const formatDateChinese = (dateStr) => {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${month}月${day}日`;
};

// Convert "2026-02-11" to "2026/02/11" for backend
const toSlashDate = (isoDate) => {
  if (!isoDate) return isoDate;
  return isoDate.replace(/-/g, '/');
};

const STANDARD_TAGS = "#Netflix #奈飞 #网剧 #新剧 #美剧";

const App = () => {
  const [startDate, setStartDate] = useState('2026-02-09');
  const [endDate, setEndDate] = useState('2026-02-15');
  const [titleType, setTitleType] = useState('新片上映');
  const [status, setStatus] = useState('idle'); // idle, scraping, generating_note, completed, stopped, failed
  const [jobId, setJobId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [eta, setEta] = useState(0);
  const [total, setTotal] = useState(0);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [generatingNote, setGeneratingNote] = useState(false);
  const [titleCopied, setTitleCopied] = useState(false);
  const [contentCopied, setContentCopied] = useState(false);
  const [titleImage, setTitleImage] = useState(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const logEndRef = useRef(null);

  // Polling effect for scraping status
  useEffect(() => {
    if (status === 'scraping' && jobId) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${jobId}`);
          const data = await res.json();
          setLogs(data.logs || []);
          setCount(data.processed || 0);
          setEta(data.eta_seconds || 0);
          setTotal(data.total_est || 0);
          if (data.status === 'completed') {
            clearInterval(interval);
            setStatus('generating_note');
            await fetchResults();
          } else if (data.status === 'stopped') {
            clearInterval(interval);
            setStatus('stopped');
            await fetchResults();
          } else if (data.status === 'failed') {
            setStatus('failed');
            clearInterval(interval);
            setGeneratingNote(false);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [status, jobId]);

  // Auto-generate note when scraping completes
  useEffect(() => {
    if (status === 'generating_note') {
      const generateNote = async () => {
        try {
          const resResults = await fetch('/api/results');
          const resultsData = await resResults.json();
          setResults(resultsData);

          const dynamicTitle = `新片上映！Netflix 本周 ${resultsData.length} 部新片拯救剧荒`;
          
          const res = await fetch('/api/generate_note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              start_date: toSlashDate(startDate), 
              end_date: toSlashDate(endDate),
              override_title: dynamicTitle,
              override_tags: STANDARD_TAGS
            })
          });
          const data = await res.json();
          if (data.note) {
            setNoteTitle(dynamicTitle);
            let content = data.note;
            if (content.startsWith(dynamicTitle)) {
              content = content.replace(dynamicTitle, '').trim();
            }
            setNoteContent(content);
            setStatus('completed');
          } else {
            setStatus('completed');
          }
        } catch (err) {
          console.error('Generate note error:', err);
          setStatus('completed');
        } finally {
          setGeneratingNote(false);
        }
      };
      setGeneratingNote(true);
      generateNote();
    }
  }, [status, titleType, startDate, endDate]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const fetchResults = async () => {
    try {
      const res = await fetch('/api/results');
      const data = await res.json();
      setResults(data);
    } catch (err) {
      console.error('Fetch results error:', err);
    }
  };

  const handleDownload = async () => {
    try {
      const formattedStart = startDate.replace(/-/g, '');
      const formattedEnd = endDate.replace(/-/g, '');
      const zipName = `[${formattedStart}-${formattedEnd}]奈飞笔记.zip`;

      const res = await fetch('/api/download');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();

      if (window.showSaveFilePicker) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: zipName,
            types: [{
              description: 'ZIP Archive',
              accept: { 'application/zip': ['.zip'] },
            }],
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } catch (pickerErr) {
          // User cancelled the prompt, ignore
          if (pickerErr.name !== 'AbortError') {
            throw pickerErr;
          }
        }
      } else {
        // Fallback for browsers that do not support showSaveFilePicker
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = zipName;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Download error:', err);
      alert('下载出错，请重试');
    }
  };

  const handleGenerateNote = async () => {
    setGeneratingNote(true);
    const dynamicTitle = `新片上映！Netflix 本周 ${results.length} 部新片拯救剧荒`;
    
    try {
      const res = await fetch('/api/generate_note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          start_date: toSlashDate(startDate), 
          end_date: toSlashDate(endDate),
          override_title: dynamicTitle,
          override_tags: STANDARD_TAGS
        })
      });
      const data = await res.json();
      if (data.note) {
        setNoteTitle(dynamicTitle);
        let content = data.note;
        if (content.startsWith(dynamicTitle)) {
          content = content.replace(dynamicTitle, '').trim();
        }
        setNoteContent(content);
      } else {
        console.error('Note generation failed:', data.error);
      }
    } catch (err) {
      console.error('Generate note error:', err);
    } finally {
      setGeneratingNote(false);
    }
  };

  const copyToClipboard = (text, setCopied) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Copy failed:', err);
    });
  };

  const handleStop = async () => {
    if (jobId) {
      try {
        await fetch(`/api/stop/${jobId}`, { method: 'POST' });
      } catch (err) {
        console.error('Stop error:', err);
      }
    }
  };

  const handleRunWorkflow = async () => {
    if (new Date(endDate) < new Date(startDate)) {
      alert('⚠️ 结束日期不能早于开始日期，请重新选择');
      return;
    }

    setStatus('scraping');
    setLogs([]);
    setCount(0);
    setTitleImage(null);
    setGeneratingTitle(true);
    setGeneratingNote(false);
    setResults([]);
    setNoteTitle('');
    setNoteContent('');
    setLogsExpanded(true);

    // Trigger Title Generation in parallel
    fetch('/api/generate_title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date_range: `${formatDateChinese(startDate)}～${formatDateChinese(endDate)}`, title: titleType })
    })
    .then(res => res.json())
    .then(data => {
      if (data.image_url) setTitleImage(data.image_url);
    })
    .catch(err => console.error("Title generation error:", err))
    .finally(() => setGeneratingTitle(false));

    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: toSlashDate(startDate), end_date: toSlashDate(endDate) })
      });
      const data = await res.json();
      setJobId(data.job_id);
    } catch (err) {
      setStatus('failed');
      console.error('Start scrape error:', err);
    }
  };

  const isRunning = status === 'scraping' || status === 'generating_note';
  const hasResults = results.length > 0 || status === 'completed' || status === 'stopped';

  return (
    <div className="min-h-screen selection:bg-netflix-red selection:text-white">
      {/* Visual Backdrops */}
      <div className="bg-cinematic" />
      <div className="bg-cinematic-overlay" />

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-5 py-8 space-y-8 relative z-10">
        
        {/* ========== Header ========== */}
        <header className="flex items-center gap-4 pt-4 pb-2">
          <div className="w-10 h-10 bg-netflix-red rounded-lg flex items-center justify-center font-black text-lg shadow-lg shadow-netflix-red/30 shrink-0">
            N
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight uppercase">
              Netflix <span className="text-netflix-red">Meta</span> Scraper
            </h1>
            <p className="text-white/40 text-sm">自动化采集 Netflix 新片数据 · 生成小红书图文素材</p>
          </div>
        </header>

        {/* ========== Control Panel ========== */}
        <section className="glass rounded-2xl p-6">
          <div className="flex flex-col md:flex-row items-end gap-5">
            {/* Date Inputs */}
            <div className="flex-1 grid grid-cols-2 md:grid-cols-3 gap-4 w-full">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-netflix-red" />
                  开始日期
                </label>
                <input 
                  type="date" 
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-semibold focus:outline-none focus:border-netflix-red focus:ring-1 focus:ring-netflix-red/30 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3 text-netflix-red" />
                  结束日期
                </label>
                <input 
                  type="date" 
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-semibold focus:outline-none focus:border-netflix-red focus:ring-1 focus:ring-netflix-red/30 transition-all"
                />
              </div>
              <div className="space-y-1.5 col-span-2 md:col-span-1">
                <label className="text-[11px] font-bold uppercase tracking-widest text-white/40 flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-netflix-red" />
                  封面标题
                </label>
                <div className="relative">
                  <select 
                    value={titleType}
                    onChange={(e) => setTitleType(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-base font-semibold focus:outline-none focus:border-netflix-red focus:ring-1 focus:ring-netflix-red/30 transition-all appearance-none pr-10"
                  >
                    <option value="新片上映" className="bg-netflix-black">新片上映</option>
                    <option value="收视冠军" className="bg-netflix-black">收视冠军</option>
                    <option value="本周上新" className="bg-netflix-black">本周上新</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="shrink-0 w-full md:w-auto">
              {!isRunning ? (
                <button 
                  onClick={handleRunWorkflow}
                  className="w-full md:w-auto px-8 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all cursor-pointer bg-netflix-red hover:bg-white hover:text-netflix-red shadow-lg shadow-netflix-red/30 active:scale-95"
                >
                  <Zap className="w-5 h-5 fill-current" />
                  {status === 'completed' || status === 'stopped' ? '重新采集' : '开始采集'}
                </button>
              ) : (
                <button 
                  onClick={handleStop}
                  className="w-full md:w-auto px-8 py-3 rounded-xl font-bold text-base flex items-center justify-center gap-2 transition-all cursor-pointer bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/30 active:scale-95"
                >
                  <Square className="w-4 h-4 fill-current" />
                  停止采集
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ========== Progress Bar (shows during scraping) ========== */}
        <AnimatePresence>
          {isRunning && (
            <motion.section 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass rounded-2xl p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-netflix-red" />
                  <span className="text-sm font-bold text-netflix-red">
                    {status === 'generating_note' ? '正在生成 AI 文案...' : '正在采集数据...'}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-white/50">
                  <span className="flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    已采集 <span className="text-white font-bold">{count}</span> 部
                  </span>
                  {eta > 0 && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      预计 <span className="text-netflix-red font-bold">{eta}s</span>
                    </span>
                  )}
                </div>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((count / (total || 100)) * 100, 95)}%` }}
                  transition={{ duration: 0.5 }}
                  className="h-full bg-netflix-red rounded-full shadow-[0_0_10px_rgba(229,9,20,0.4)]"
                />
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* ========== Collapsible Logs Panel ========== */}
        {logs.length > 0 && (
          <section className="glass rounded-2xl overflow-hidden">
            <button 
              onClick={() => setLogsExpanded(!logsExpanded)}
              className="w-full px-5 py-3 flex justify-between items-center cursor-pointer hover:bg-white/[0.02] transition-colors"
            >
              <h3 className="font-semibold text-sm flex items-center gap-2 text-white/60">
                <ScrollText className="w-4 h-4 text-netflix-red" />
                执行日志
                <span className="text-white/30 text-xs">({logs.length})</span>
              </h3>
              {logsExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
            </button>
            <AnimatePresence>
              {logsExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="max-h-[250px] overflow-y-auto px-5 pb-4 mono text-xs leading-relaxed space-y-0.5 border-t border-white/5">
                    {logs.map((log, i) => (
                      <div key={i} className="text-white/50 py-0.5">
                        <span className="text-white/15 mr-3 tabular-nums">[{String(i+1).padStart(3, '0')}]</span>
                        {log}
                      </div>
                    ))}
                    <div ref={logEndRef} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        )}

        {/* ========== Generated Cover & Stats ========== */}
        {(titleImage || generatingTitle) && (
          <section className="glass rounded-2xl p-6">
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="w-full md:w-48 aspect-[3/4] bg-black/50 rounded-xl overflow-hidden relative shadow-2xl border border-white/10 group shrink-0">
                {titleImage ? (
                  <>
                    <img 
                      key={titleImage}
                      src={`/images/${titleImage}?t=${Date.now()}`} 
                      className="w-full h-full object-cover" 
                      alt="封面图" 
                    />
                    <button 
                      onClick={handleDownload}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 font-bold text-sm text-white cursor-pointer"
                    >
                      <Download className="w-5 h-5" /> 下载所有素材
                    </button>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center flex-col gap-3 text-white/30">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">生成封面中...</span>
                  </div>
                )}
              </div>
              <div className="flex-1 space-y-4 text-center md:text-left">
                <div>
                  <h3 className="text-xl font-black uppercase tracking-tight mb-1">小红书素材包</h3>
                  <p className="text-white/40 text-sm">
                    封面 + <span className="text-white font-semibold">{count}</span> 张高清海报，已就绪
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                  <span className="px-3 py-1.5 bg-white/5 rounded-lg text-[11px] font-bold text-white/40">1242×1656px 封面</span>
                  <span className="px-3 py-1.5 bg-white/5 rounded-lg text-[11px] font-bold text-white/40">450×630px 海报</span>
                </div>
                {hasResults && (
                  <button 
                    onClick={handleDownload}
                    className="inline-flex items-center gap-2 px-6 py-2.5 bg-netflix-red hover:bg-white hover:text-netflix-red text-sm font-bold rounded-xl transition-all cursor-pointer active:scale-95 shadow-lg shadow-netflix-red/20"
                  >
                    <Download className="w-4 h-4" /> 下载素材包 (.zip)
                  </button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ========== AI Note Section ========== */}
        {(noteContent || generatingNote) && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                AI 文案
              </h2>
              {hasResults && !generatingNote && (
                <button
                  onClick={handleGenerateNote}
                  className="text-xs font-bold px-4 py-2 rounded-full bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" /> 重新生成
                </button>
              )}
            </div>

            {/* Title Card */}
            <div className="glass p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">标题</span>
                <button 
                  onClick={() => copyToClipboard(noteTitle, setTitleCopied)}
                  disabled={!noteTitle}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer
                    ${titleCopied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/15 text-white/60'}`}
                >
                  {titleCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {titleCopied ? "已复制" : "复制"}
                </button>
              </div>
              <div className="bg-black/30 rounded-lg p-3 font-semibold text-base min-h-[40px] flex items-center">
                {generatingNote ? (
                  <span className="flex items-center gap-2 text-white/30 animate-pulse text-sm">
                    <Loader2 className="w-3 h-3 animate-spin" /> 生成标题中...
                  </span>
                ) : (
                  noteTitle || "等待生成..."
                )}
              </div>
            </div>

            {/* Content Card */}
            <div className="glass p-5 rounded-2xl border-purple-500/10">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-white/30">正文</span>
                <button 
                  onClick={() => copyToClipboard(noteContent, setContentCopied)}
                  disabled={!noteContent}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5 cursor-pointer
                    ${contentCopied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/15 text-white/60'}`}
                >
                  {contentCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {contentCopied ? "已复制" : "复制"}
                </button>
              </div>
              <div className="bg-black/30 rounded-lg p-3 text-sm leading-relaxed whitespace-pre-wrap min-h-[100px] max-h-[300px] overflow-y-auto custom-scrollbar">
                {generatingNote ? (
                  <span className="flex items-center gap-2 text-white/30 animate-pulse text-sm">
                    <Loader2 className="w-3 h-3 animate-spin" /> 正在撰写小红书文案...
                  </span>
                ) : (
                  noteContent || "等待生成..."
                )}
              </div>
            </div>
          </section>
        )}

        {/* ========== Poster Gallery ========== */}
        <section className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-0.5 bg-netflix-red rounded-full" />
              <h2 className="text-xl font-black uppercase tracking-tight">影片海报</h2>
              {results.length > 0 && (
                <span className="text-white/30 text-sm font-semibold">{results.length} 部</span>
              )}
            </div>
            {hasResults && (
              <button 
                onClick={handleDownload}
                className="bg-white/5 hover:bg-netflix-red text-white text-xs font-bold py-2 px-5 rounded-full flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" /> 下载全部
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            <AnimatePresence mode="popLayout">
              {results.map((item, i) => (
                <motion.div 
                  key={item.Title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: i * 0.03 }}
                  className="group relative cursor-pointer"
                >
                  <div className="aspect-[450/630] bg-white/5 rounded-xl overflow-hidden border border-white/5 active:scale-95 transition-all card-scale shadow-xl relative">
                    <img 
                      src={`/images/${item["Poster Filename"]}`} 
                      alt={item.Title}
                      loading="lazy"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 grayscale-[20%] group-hover:grayscale-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Overlay Content */}
                    <div className="absolute inset-0 p-4 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <p className="text-[9px] font-bold uppercase tracking-widest text-netflix-red mb-1">{item["Release Date"]}</p>
                      <h4 className="text-sm font-bold leading-snug mb-3 drop-shadow-lg">{item.Title}</h4>
                      <a 
                        href={item["Watch URL"]} 
                        target="_blank" 
                        className="bg-white text-black py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-netflix-red hover:text-white transition-colors"
                      >
                        <Play className="w-3 h-3 fill-current" /> 观看
                      </a>
                    </div>
                  </div>
                </motion.div>
              ))}
              {results.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="aspect-[450/630] bg-white/[0.02] rounded-xl border border-dashed border-white/5 flex items-center justify-center text-white/[0.03]">
                  <ImageIcon className="w-12 h-12" />
                </div>
              ))}
            </AnimatePresence>
          </div>
        </section>

        {/* ========== Footer ========== */}
        <footer className="pt-12 pb-6 border-t border-white/5 text-center text-white/15 text-[10px] font-bold uppercase tracking-[0.4em]">
          Powered by Deepmind Antigravity
        </footer>
      </div>
    </div>
  );
};

export default App;
