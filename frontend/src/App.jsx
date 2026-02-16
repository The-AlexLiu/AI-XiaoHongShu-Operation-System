import React, { useState, useEffect, useRef } from 'react';
import { Play, Calendar, Download, CheckCircle2, Loader2, Image as ImageIcon, ExternalLink, ScrollText, Zap, Shield, Globe, Sparkles, X, Copy, Check, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Convert "2026/02/11" to "2月11日" format
const formatDateChinese = (dateStr) => {
  if (!dateStr) return dateStr;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  return `${month}月${day}日`;
};

const App = () => {
  const [startDate, setStartDate] = useState('2026/02/09');
  const [endDate, setEndDate] = useState('2026/02/15');
  const [titleType, setTitleType] = useState('新片上映');
  const [status, setStatus] = useState('idle'); // idle, running, scraping, generating_note, completed, failed
  const [jobId, setJobId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [results, setResults] = useState([]);
  const [count, setCount] = useState(0);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [generatingNote, setGeneratingNote] = useState(false);
  const [titleCopied, setTitleCopied] = useState(false);
  const [contentCopied, setContentCopied] = useState(false);
  const [titleImage, setTitleImage] = useState(null);
  const [generatingTitle, setGeneratingTitle] = useState(false);
  const logEndRef = useRef(null);

  useEffect(() => {
    if ((status === 'running' || status === 'scraping') && jobId) {
      const interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/status/${jobId}`);
          const data = await res.json();
          setLogs(data.logs || []);
          setCount(data.count || 0);
          if (data.status === 'completed') {
            clearInterval(interval);
            setStatus('generating_note');
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

  useEffect(() => {
    if (status === 'generating_note') {
      const generateNote = async () => {
        try {
          const resResults = await fetch('/api/results');
          const resultsData = await resResults.json();
          setResults(resultsData);

          const dynamicTitle = `${titleType}！Netflix 本周 ${resultsData.length} 部新片，拯救剧荒`;
          
          const res = await fetch('/api/generate_note', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              start_date: startDate, 
              end_date: endDate,
              override_title: dynamicTitle,
              override_tags: STANDARD_TAGS
            })
          });
          const data = await res.json();
          if (data.note) {
            // Split title and content if possible, or just use the whole note
            // Assuming the AI returns the title in the first line or we use our dynamicTitle
            // Let's use the dynamicTitle as the title since we enforced it in the prompt
            setNoteTitle(dynamicTitle);
            
            // Remove title from content if it appears there to avoid duplication
            let content = data.note;
            if (content.startsWith(dynamicTitle)) {
                content = content.replace(dynamicTitle, '').trim();
            }
            setNoteContent(content);
            setStatus('completed');
          } else {
            setStatus('failed');
          }
        } catch (err) {
          console.error('Generate note error:', err);
          setStatus('failed');
        } finally {
          setGeneratingNote(false);
        }
      };
      generateNote();
    }
  }, [status, titleType, startDate, endDate]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Standardized tags
  const STANDARD_TAGS = "#Netflix #奈飞 #网剧 #新剧 #美剧";

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
      window.open('/api/download', '_blank');
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  const handleGenerateNote = async () => {
    setGeneratingNote(true);
    const dynamicTitle = `${titleType}！Netflix 本周 ${results.length} 部新片，拯救剧荒`;
    
    try {
      const res = await fetch('/api/generate_note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            start_date: startDate, 
            end_date: endDate,
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

  const copyTitle = () => {
    navigator.clipboard.writeText(noteTitle).then(() => {
        setTitleCopied(true);
        setTimeout(() => setTitleCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy title:', err);
        alert('Copy failed. Please copy manually.');
    });
  };

  const copyContent = () => {
    navigator.clipboard.writeText(noteContent).then(() => {
        setContentCopied(true);
        setTimeout(() => setContentCopied(false), 2000);
    }).catch(err => {
        console.error('Failed to copy content:', err);
        alert('Copy failed. Please copy manually.');
    });
  };

  const handleRunWorkflow = async () => {
    setStatus('scraping');
    setLogs([]);
    setCount(0);
    setTitleImage(null);
    setGeneratingTitle(true);
    setGeneratingNote(true);
    setResults([]);

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
        body: JSON.stringify({ start_date: startDate, end_date: endDate })
      });
      const data = await res.json();
      setJobId(data.job_id);
    } catch (err) {
      setStatus('failed');
      console.error('Start scrape error:', err);
      setGeneratingNote(false);
    }
  };

  return (
    <div className="min-h-screen selection:bg-netflix-red selection:text-white">
      {/* Visual Backdrops */}
      <div className="bg-cinematic" />
      <div className="bg-cinematic-overlay" />

      {/* Main Content */}
      <div className="max-w-[1400px] mx-auto px-6 py-12 space-y-24 relative z-10">
        
        {/* Header Hero */}
        <header className="flex flex-col items-center text-center space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-16 h-16 bg-netflix-red rounded-xl flex items-center justify-center font-black text-3xl shadow-2xl shadow-netflix-red/40"
          >
            N
          </motion.div>
          <div className="space-y-2">
            <h1 className="text-6xl font-black tracking-tighter uppercase hero-text">
               Netflix <span className="text-netflix-red">Meta</span> Scraper
            </h1>
            <p className="text-white/50 text-xl font-medium max-w-2xl mx-auto leading-relaxed">
              Premium automation for high-fidelity movie posters and structured metadata extraction at scale.
            </p>
          </div>
        </header>

        {/* Control & Tracking Grid */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Controls Hook */}
          <div className="lg:col-span-12 flex justify-center">
             <div className="glass w-full max-w-4xl p-1 px-1 rounded-[2rem] flex flex-col md:flex-row items-center gap-4 overflow-hidden">
                <div className="flex-1 flex items-center gap-6 px-8 py-4 w-full">
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Horizon Begin</p>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-netflix-red" />
                      <input 
                        type="text" 
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="bg-transparent text-xl font-black focus:outline-none w-full border-b border-white/10 focus:border-netflix-red transition-all"
                        placeholder="2026/02/09"
                      />
                    </div>
                  </div>
                  <div className="w-px h-12 bg-white/10 hidden md:block" />
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Horizon End</p>
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-netflix-red" />
                      <input 
                        type="text" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="bg-transparent text-xl font-black focus:outline-none w-full border-b border-white/10 focus:border-netflix-red transition-all"
                        placeholder="2026/02/20"
                      />
                    </div>
                  </div>
                  <div className="w-px h-12 bg-white/10 hidden md:block" />
                  <div className="flex-1 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40 mb-1">Title Strategy</p>
                    <div className="relative flex items-center gap-3">
                      <ChevronDown className="absolute right-0 w-4 h-4 text-white/30 pointer-events-none" />
                      <select 
                        value={titleType}
                        onChange={(e) => setTitleType(e.target.value)}
                        className="bg-transparent text-xl font-black focus:outline-none w-full appearance-none border-b border-white/10 focus:border-netflix-red transition-all py-1"
                      >
                         <option value="新片上映" className="bg-black">新片上映</option>
                         <option value="收视冠军" className="bg-black">收视冠军</option>
                         <option value="本周上新" className="bg-black">本周上新</option>
                      </select>
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleRunWorkflow}
                  disabled={status === 'scraping' || status === 'generating_note' || status === 'running'}
                  className={`px-12 py-8 m-2 rounded-2xl font-black text-xl uppercase tracking-tighter flex items-center gap-3 transition-all cursor-pointer w-full md:w-auto
                    ${(status === 'scraping' || status === 'generating_note' || status === 'running')
                      ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                      : 'bg-netflix-red hover:bg-white hover:text-netflix-red shadow-2xl shadow-netflix-red/30 active:scale-95'}`}
                >
                  {(status === 'scraping' || status === 'generating_note' || status === 'running') ? <Loader2 className="w-7 h-7 animate-spin" /> : <Zap className="w-7 h-7 fill-current" />}
                  {status === 'scraping' ? "Scraping..." : status === 'generating_note' ? "Crafting..." : "Initiate"}
                </button>
             </div>
          </div>

          <div className="lg:col-span-8 space-y-12">
            {/* Live Feed */}
            <div className="glass rounded-[2.5rem] overflow-hidden flex flex-col h-[500px]">
              <div className="px-10 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                <h3 className="font-bold text-lg flex items-center gap-3">
                  <ScrollText className="w-5 h-5 text-netflix-red" />
                  Execution Logs
                </h3>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase tracking-widest">
                    <div className={`w-2 h-2 rounded-full ${(status === 'running' || status === 'scraping' || status === 'generating_note') ? 'bg-netflix-red animate-pulse' : 'bg-white/10'}`} />
                    Status: {status.replace('_', ' ')}
                  </div>
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                    <div className="w-3 h-3 rounded-full bg-white/10" />
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-10 mono text-sm leading-relaxed space-y-1 bg-black/20">
                {logs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-20">
                    <Globe className="w-12 h-12" />
                    <p className="italic font-medium">System idle. Synchronize parameters to start.</p>
                  </div>
                )}
                {logs.map((log, i) => (
                  <div key={i} className="text-white/60">
                     <span className="text-white/20 mr-4 tabular-nums">[{String(i+1).padStart(3, '0')}]</span>
                     {log}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          </div>

          <aside className="lg:col-span-4 space-y-8">
            {/* Stats Card */}
            <div className="glass p-10 rounded-[2.5rem] relative overflow-hidden flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
                 <Shield className="w-10 h-10 text-netflix-red" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/30 mb-2">Validated Records</p>
                <h4 className="text-7xl font-black tracking-tighter">{count}</h4>
              </div>
              <p className="text-white/40 text-sm leading-relaxed px-4">
                Structured meta-data synchronized and cached for distribution.
              </p>
            </div>

            {/* Actions */}
            {(results.length > 0 || status === 'completed') && (
              <motion.button 
                onClick={handleDownload}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full glass hover:bg-white hover:text-black py-8 rounded-[2rem] font-black text-xl flex items-center justify-center gap-4 transition-all uppercase tracking-tight cursor-pointer"
              >
                <Download className="w-6 h-6" /> Export All Data
              </motion.button>
            )}

            {/* Note Display Area */}
            {(noteContent || generatingNote) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Title Section */}
                <div className="glass p-6 rounded-[2rem] border border-white/10 bg-white/[0.02]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Magic Title
                        </h4>
                        <button 
                            onClick={copyTitle}
                            disabled={!noteTitle}
                            className={`text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-2 
                                ${titleCopied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        >
                            {titleCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {titleCopied ? "Copied" : "Copy Title"}
                        </button>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4 font-medium text-lg min-h-[60px] flex items-center">
                        {generatingNote ? (
                            <div className="flex items-center gap-2 text-white/30 animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" /> Generating title...
                            </div>
                        ) : (
                            noteTitle || "Waiting for content..."
                        )}
                    </div>
                </div>

                {/* Content Section */}
                <div className="glass p-6 rounded-[2rem] border border-purple-500/20 bg-purple-500/[0.02]">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                            <ScrollText className="w-4 h-4 text-purple-500" />
                            Magic Content
                        </h4>
                        <button 
                            onClick={copyContent}
                            disabled={!noteContent}
                            className={`text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-2 
                                ${contentCopied ? 'bg-green-500/20 text-green-400' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                        >
                            {contentCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {contentCopied ? "Copied" : "Copy Content"}
                        </button>
                    </div>
                    <div className="bg-black/30 rounded-xl p-4 font-sans text-base leading-relaxed whitespace-pre-wrap min-h-[150px] max-h-[400px] overflow-y-auto custom-scrollbar">
                        {generatingNote ? (
                            <div className="flex items-center gap-2 text-white/30 animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" /> Crafting viral post...
                            </div>
                        ) : (
                            noteContent || "Waiting for content..."
                        )}
                    </div>
                </div>
              </motion.div>
            )}

            {/* Running Indicator */}
            {(status === 'running' || status === 'scraping' || status === 'generating_note') && (
              <div className="glass p-6 rounded-[2rem] space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 animate-spin text-netflix-red" />
                  <span className="text-sm font-bold uppercase tracking-widest text-netflix-red animate-pulse">
                    {status === 'generating_note' ? 'Crafting Note...' : 'Engine Active'}
                  </span>
                </div>
                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((count / 20) * 100, 95)}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full bg-netflix-red rounded-full shadow-[0_0_15px_rgba(229,9,20,0.5)]"
                  />
                </div>
                <p className="text-xs text-white/40 text-center">{count} items collected so far</p>
              </div>
            )}
          </aside>
        </section>

        {/* Generated Assets Section */}
        {(titleImage || generatingTitle) && (
            <section className="space-y-6">
                <div className="glass p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center gap-10">
                    <div className="w-full md:w-1/3 aspect-[3/4] bg-black/50 rounded-2xl overflow-hidden relative shadow-2xl border border-white/10 group">
                        {titleImage ? (
                            <>
                            <img 
                                key={titleImage} // Force reload on change
                                src={`/images/${titleImage}?t=${Date.now()}`} 
                                className="w-full h-full object-cover" 
                                alt="Title Page" 
                            />
                            <button 
                                onClick={handleDownload}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 font-bold text-white cursor-pointer"
                            >
                                <Download className="w-6 h-6" /> Download All Assets
                            </button>
                            </>
                        ) : (
                            <div className="w-full h-full flex items-center justify-center flex-col gap-4 text-white/30">
                                <Loader2 className="w-10 h-10 animate-spin" />
                                <span className="text-xs font-bold uppercase tracking-widest">Generating Cover...</span>
                            </div>
                        )}
                    </div>
                    <div className="flex-1 space-y-6 text-center md:text-left">
                        <div>
                            <h3 className="text-3xl font-black uppercase tracking-tighter mb-2">Social Media Kit</h3>
                            <p className="text-white/50 text-lg">
                                Ready-to-post cover image + <span className="text-white">{results.length}</span> extracted posters.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                             <div className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-netflix-red" /> 1242x1656px
                             </div>
                             <div className="px-4 py-2 bg-white/5 rounded-lg text-xs font-bold uppercase tracking-wider text-white/40 flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4 text-netflix-red" /> Retina Quality
                             </div>
                        </div>
                    </div>
                </div>
            </section>
        )}

        {/* Interactive Gallery */}
        <section className="space-y-12">
           <div className="flex flex-col items-center space-y-4 text-center">
              <div className="w-12 h-1 bg-netflix-red rounded-full" />
              <div className="flex items-center gap-6">
                <h2 className="text-4xl font-black uppercase tracking-tighter">Captured Masterpieces</h2>
                {(results.length > 0 || status === 'completed') && (
                  <button 
                    onClick={handleDownload}
                    className="bg-netflix-red hover:bg-white hover:text-netflix-red text-white text-sm font-bold py-3 px-8 rounded-full flex items-center gap-2 transition-all cursor-pointer active:scale-95 shadow-lg shadow-netflix-red/30"
                  >
                    <Download className="w-4 h-4" /> Download All (.zip)
                  </button>
                )}
              </div>
              <p className="text-white/40 font-medium">Visual assets synchronized from Netflix Content Delivery Network.</p>
           </div>

           <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
              <AnimatePresence mode="popLayout">
                {results.map((item, i) => (
                  <motion.div 
                    key={item.Title}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: i * 0.04 }}
                    className="group relative cursor-pointer"
                  >
                    <div className="aspect-[450/630] bg-white/5 rounded-2xl overflow-hidden border border-white/5 active:scale-95 transition-all card-scale shadow-2xl relative">
                       <img 
                          src={`/images/${item["Poster Filename"]}`} 
                          alt={item.Title}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 grayscale-[30%] group-hover:grayscale-0"
                          onError={(e) => { e.target.style.display = 'none'; }}
                       />
                       <div className="absolute inset-0 bg-gradient-to-t from-black 0% via-black/40 50% to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                       
                       {/* Overlay Content */}
                       <div className="absolute inset-0 p-6 flex flex-col justify-end opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-4 group-hover:translate-y-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-netflix-red mb-2">{item["Release Date"]}</p>
                          <h4 className="text-lg font-black leading-tight mb-4 drop-shadow-lg">{item.Title}</h4>
                          <div className="flex gap-2">
                             <a 
                                href={item["Watch URL"]} 
                                target="_blank" 
                                className="flex-1 bg-white text-black py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-netflix-red hover:text-white transition-colors"
                             >
                                <Play className="w-3.5 h-3.5 fill-current" /> Play
                             </a>
                          </div>
                       </div>
                    </div>
                  </motion.div>
                ))}
                {results.length === 0 && Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="aspect-[450/630] bg-white/[0.03] rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-white/[0.02]">
                     <ImageIcon className="w-16 h-16" />
                  </div>
                ))}
              </AnimatePresence>
           </div>
        </section>

        {/* Footer */}
        <footer className="pt-24 border-t border-white/5 text-center text-white/20 text-xs font-bold uppercase tracking-[0.5em]">
          Automated by Deepmind Antigravity • Premium Extraction Engine v2.0
        </footer>
      </div>
      
      {/* Note Modal Removed */}
    </div>
  );
};

export default App;
