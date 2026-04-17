import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Stethoscope, 
  Activity, 
  Volume2, 
  Send, 
  Zap,
  Info,
  FileText,
  Camera,
  Upload,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as aiService from './services/aiService';

const CIRCUMFERENCE = 2 * Math.PI * 83;

export default function App() {
  // Timer State
  const [timerDuration, setTimerDuration] = useState(3600); // Default 60 minutes
  const [timeLeft, setTimeLeft] = useState(3600);
  const [isActive, setIsActive] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);
  const [isBreak, setIsBreak] = useState(false);
  
  // App State
  const [completedSessions, setCompletedSessions] = useState(0);
  const [voiceOn, setVoiceOn] = useState(true);
  const [alarmOn, setAlarmOn] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  // Audio Refs
  const chimeRef = useRef<HTMLAudioElement | null>(null);

  // Initialize Audio
  useEffect(() => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.loop = true;
    chimeRef.current = audio;
    return () => {
      audio.pause();
    };
  }, []);
  
  // AI Feedback States
  const [aiSuggestion, setAiSuggestion] = useState('');
  const [motivation, setMotivation] = useState('');
  const [dailyReport, setDailyReport] = useState('Complete your first session to get your AI health report!');
  const [assistantReply, setAssistantReply] = useState('');
  const [medicalReply, setMedicalReply] = useState<{ text: string; urgency: string } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  
  // Prescription Reader States
  const [prescriptionImage, setPrescriptionImage] = useState<string | null>(null);
  const [isAnalyzingPrescription, setIsAnalyzingPrescription] = useState(false);
  const [prescriptionAnalysis, setPrescriptionAnalysis] = useState<{ text: string; urgency: string } | null>(null);

  // Inputs
  const [assistantInput, setAssistantInput] = useState('');
  const [medicalInput, setMedicalInput] = useState('');

  // Refs
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Timer logic
  useEffect(() => {
    let interval: number;
    if (isActive && timeLeft > 0 && !isBreak) {
      interval = window.setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (timeLeft === 0 && !isBreak) {
      handleBreakTrigger();
    }
    return () => clearInterval(interval);
  }, [isActive, timeLeft, isBreak]);

  const speak = useCallback((text: string) => {
    if (!voiceOn) return;
    window.speechSynthesis.cancel();
    
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.95;
    utter.pitch = 1.1;
    
    // Try to find a nice female voice as in the HTML
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => (v.name.includes('Samantha') || v.name.includes('Google UK English Female') || v.name.includes('Female'))) || voices[0];
    if (preferred) utter.voice = preferred;

    utter.onstart = () => setIsSpeaking(true);
    utter.onend = () => setIsSpeaking(false);
    utter.onerror = () => setIsSpeaking(false);
    
    speechRef.current = utter;
    window.speechSynthesis.speak(utter);
  }, [voiceOn]);

  const handleBreakTrigger = async () => {
    setIsBreak(true);
    setIsActive(false);
    setCompletedSessions(prev => prev + 1);
    
    const timeOfDay = new Date().getHours() < 12 ? 'morning' : 'afternoon';
    const hours = Math.round(timerDuration / 3600 * 10) / 10;
    
    speak(`Break time! You have been at the screen for ${hours} hours. Let's get moving.`);
    
    if (alarmOn && chimeRef.current) {
      chimeRef.current.currentTime = 0;
      chimeRef.current.play().catch(e => console.log("Audio playback failed:", e));
    }
    
    // Fetch AI Suggestions
    setIsAiLoading(true);
    const [suggestion, motiv] = await Promise.all([
      aiService.getAiSuggestion(completedSessions + 1, timeOfDay),
      aiService.getMotivationalMessage(completedSessions + 1)
    ]);
    
    setAiSuggestion(suggestion);
    setMotivation(motiv);
    setIsAiLoading(false);
    
    speak(`${suggestion}. ${motiv}`);
  };

  const startNextSession = () => {
    setIsBreak(false);
    if (chimeRef.current) chimeRef.current.pause();
    setTimeLeft(timerDuration);
    setSessionCount(prev => prev + 1);
    setIsActive(true);
    window.speechSynthesis.cancel();
    if (completedSessions > 0) generateDailyReport();
  };

  const snooze = () => {
    setIsBreak(false);
    if (chimeRef.current) chimeRef.current.pause();
    setTimeLeft(300); // 5 minutes
    setIsActive(true);
    window.speechSynthesis.cancel();
  };

  const changeDuration = (seconds: number) => {
    setTimerDuration(seconds);
    setTimeLeft(seconds);
    setIsActive(false);
  };

  const generateDailyReport = async () => {
    const report = await aiService.getDailyReport(completedSessions, completedSessions);
    setDailyReport(report);
  };

  const handleAssistantAsk = async () => {
    if (!assistantInput.trim()) return;
    const q = assistantInput;
    setAssistantInput('');
    setAssistantReply('Thinking...');
    
    const context = `User has taken ${completedSessions} breaks today. Next break in ${Math.floor(timeLeft/60)} minutes.`;
    const reply = await aiService.getAssistantReply(q, context);
    setAssistantReply(reply);
    speak(reply);
  };

  const handleMedicalAsk = async () => {
    if (!medicalInput.trim()) return;
    const symptoms = medicalInput;
    setMedicalInput('');
    setMedicalReply({ text: 'Checking symptoms...', urgency: 'ROUTINE' });
    
    const guidance = await aiService.getMedicalGuidance(symptoms);
    
    let urgency = 'ROUTINE';
    if (guidance.includes('[EMERGENCY]')) urgency = 'EMERGENCY';
    else if (guidance.includes('[SOON]')) urgency = 'SOON';
    
    const cleanText = guidance.replace(/\[(ROUTINE|SOON|EMERGENCY)\]/g, '').trim();
    setMedicalReply({ text: cleanText, urgency });
    
    const urgencyMsg = urgency === 'EMERGENCY' ? 'Please seek medical attention immediately.' : urgency === 'SOON' ? 'You should see a doctor soon.' : '';
    speak(`${cleanText}. ${urgencyMsg}`);
  };

  const handlePrescriptionUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      setPrescriptionImage(base64);
      setPrescriptionAnalysis(null);
      setIsAnalyzingPrescription(true);

      const analysis = await aiService.analyzePrescription(base64, file.type);
      
      let urgency = 'ROUTINE';
      if (analysis.includes('[EMERGENCY]')) urgency = 'EMERGENCY';
      else if (analysis.includes('[SOON]')) urgency = 'SOON';
      
      const cleanText = analysis.replace(/\[(ROUTINE|SOON|EMERGENCY)\]/g, '').trim();
      setPrescriptionAnalysis({ text: cleanText, urgency });
      setIsAnalyzingPrescription(false);
      
      const urgencyMsg = urgency === 'EMERGENCY' ? 'This looks urgent based on the prescription. Please check with your doctor immediately.' : '';
      speak(`Prescription analysis complete. ${cleanText}. ${urgencyMsg}`);
    };
    reader.readAsDataURL(file);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressOffset = CIRCUMFERENCE * (timeLeft / timerDuration);

  return (
    <div className="app w-full max-w-[430px] mx-auto px-4 py-8 space-y-6">
      {/* Brand */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="font-syne text-4xl font-extrabold tracking-tight">
          Health <span className="text-brand-accent">Buddy</span>
          <sup className="text-xs text-brand-accent2 font-dm font-medium ml-1">AI</sup>
        </h1>
        <p className="text-sm text-brand-muted">Your smart hourly wellness companion</p>
        <div className="flex gap-2 justify-center">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] bg-brand-accent2/10 border border-brand-accent2/25 text-brand-accent2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent2 animate-pulse-custom" />
            Gemini AI Powered
          </span>
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] bg-brand-accent/10 border border-brand-accent/25 text-brand-accent">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse-custom" />
            Health Buddy v1
          </span>
        </div>
      </motion.div>

      {/* Settings Row */}
      <div className="flex flex-col gap-3 bg-brand-card border border-white/10 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2 size={16} className="text-brand-accent" />
            <span className="text-xs text-brand-text font-medium">Voice AI</span>
          </div>
          <button 
            onClick={() => setVoiceOn(!voiceOn)}
            className={`relative w-10 h-5 rounded-full transition-colors ${voiceOn ? 'bg-brand-accent' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${voiceOn ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        
        <div className="flex items-center justify-between border-t border-white/5 pt-3">
          <div className="flex items-center gap-2">
            <Zap size={16} className="text-brand-accent2" />
            <span className="text-xs text-brand-text font-medium">Hourly Alarm Chime</span>
          </div>
          <button 
            onClick={() => setAlarmOn(!alarmOn)}
            className={`relative w-10 h-5 rounded-full transition-colors ${alarmOn ? 'bg-brand-accent2' : 'bg-white/10'}`}
          >
            <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${alarmOn ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>

        {isSpeaking && (
          <div className="flex items-center justify-center gap-1.5 text-brand-accent text-[10px] font-bold pt-2 border-t border-white/5">
            <div className="flex gap-0.5 items-center">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className={`w-0.5 rounded-full bg-brand-accent animate-wave`} style={{ height: `${[6, 10, 14, 10, 6][i-1]}px`, animationDelay: `${i*0.1}s` }} />
              ))}
            </div>
            Voice Assistant Speaking...
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!isBreak ? (
          <motion.div
            key="timer"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-brand-card border border-white/5 rounded-brand p-8 text-center space-y-6 relative overflow-hidden shadow-2xl"
          >
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-accent to-transparent opacity-50" />
            
            <div className="relative w-48 h-48 mx-auto">
              <svg width="192" height="192" viewBox="0 0 192 192" className="-rotate-90">
                <circle cx="96" cy="96" r="83" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
                <motion.circle 
                  cx="96" cy="96" r="83" 
                  fill="none" 
                  stroke={timeLeft <= 300 ? '#f0c040' : '#3dd68c'} 
                  strokeWidth="8" 
                  strokeLinecap="round"
                  style={{ strokeDasharray: CIRCUMFERENCE, strokeDashoffset: progressOffset }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-syne text-5xl font-bold tracking-tight">{formatTime(timeLeft)}</span>
                <span className="text-[10px] text-brand-muted uppercase tracking-widest mt-2">
                  {timeLeft <= 300 ? 'Break almost here' : 'Until your break'}
                </span>
              </div>
            </div>

            <div className="text-sm text-brand-muted">
              Session <strong className="text-brand-accent font-bold">#{sessionCount + 1}</strong> in progress
            </div>

            {/* Duration Selector */}
            <div className="space-y-3">
              <div className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Adjust Session Duration</div>
              <div className="flex flex-wrap gap-2 justify-center">
                {[60, 900, 1800, 2700, 3600].map(seconds => (
                  <button 
                    key={seconds}
                    onClick={() => changeDuration(seconds)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                      timerDuration === seconds 
                        ? 'bg-brand-accent text-brand-bg border-brand-accent shadow-md shadow-brand-accent/20' 
                        : 'bg-white/5 text-brand-muted border-white/10 hover:border-brand-accent/40'
                    }`}
                  >
                    {seconds === 60 ? '1m' : `${seconds/60}m`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-center">
              <button 
                onClick={() => setIsActive(!isActive)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-brand-accent text-brand-bg font-bold text-sm shadow-lg shadow-brand-accent/20 hover:scale-105 transition-transform"
              >
                {isActive ? <Pause size={16} /> : <Play size={16} />}
                {isActive ? 'Pause' : 'Resume'}
              </button>
              <button 
                onClick={() => setTimeLeft(timerDuration)}
                className="p-2.5 rounded-full border border-white/10 text-brand-muted hover:text-white"
              >
                <RotateCcw size={18} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="break"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-gradient-to-br from-[#1a2d1e] to-[#0f1f14] border border-brand-accent/30 rounded-brand p-8 text-center space-y-6 shadow-2xl"
          >
            <div className="w-14 h-14 bg-brand-accent/10 rounded-full border border-brand-accent/25 flex items-center justify-center mx-auto animate-pulse">
              <Zap className="text-brand-accent" size={28} />
            </div>
            
            <div className="space-y-1">
              <h2 className="font-syne text-2xl font-bold text-brand-accent">Break Time!</h2>
              <p className="text-sm text-brand-muted">You've reached your 1-hour screen limit.</p>
            </div>

            <div className="bg-white/5 border border-brand-accent/20 rounded-xl p-4 text-left space-y-2">
              <div className="flex items-center gap-2 text-[10px] font-bold text-brand-accent uppercase tracking-wider">
                <Activity size={12} /> AI Activity Suggestion
              </div>
              <div className="text-sm text-brand-text italic leading-relaxed min-h-[40px]">
                {isAiLoading ? (
                  <div className="flex gap-1 items-center h-4">
                    {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-brand-accent animate-bounce-custom" style={{ animationDelay: `${i*0.15}s` }} />)}
                  </div>
                ) : aiSuggestion}
              </div>
            </div>

            <div className="bg-brand-accent2/5 border border-brand-accent2/20 rounded-xl p-4 text-left space-y-1">
              <div className="text-[10px] font-bold text-brand-accent2 uppercase tracking-wider">Motivational Boost</div>
              <div className="text-sm text-brand-text leading-relaxed italic min-h-[36px]">
              {isAiLoading ? (
                  <div className="flex gap-1 items-center h-4">
                    {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-brand-accent2 animate-bounce-custom" style={{ animationDelay: `${i*0.15}s` }} />)}
                  </div>
                ) : motivation}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={startNextSession}
                className="w-full py-3 rounded-full bg-brand-accent text-brand-bg font-bold shadow-lg shadow-brand-accent/20"
              >
                Start Next Hour
              </button>
              <button 
                onClick={snooze}
                className="w-full py-2.5 rounded-full border border-white/10 text-brand-muted font-medium hover:bg-white/5"
              >
                Snooze 5 min
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Assistant */}
      <div className="bg-brand-card border border-white/5 rounded-brand p-5 space-y-4">
        <h3 className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Ask Your AI Assistant</h3>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={assistantInput}
            onChange={(e) => setAssistantInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAssistantAsk()}
            placeholder="How can I stay focused?"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-brand-accent transition-colors"
          />
          <button 
            onClick={handleAssistantAsk}
            disabled={!assistantInput.trim()}
            className="w-10 h-10 rounded-xl bg-brand-accent flex items-center justify-center text-brand-bg disabled:opacity-50 transition-opacity hover:scale-105 active:scale-95 transition-transform"
          >
            <Send size={18} />
          </button>
        </div>
        {assistantReply && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-white/10 rounded-xl p-3 text-sm leading-relaxed"
          >
            {assistantReply === 'Thinking...' ? (
              <div className="flex gap-1 items-center">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-brand-accent animate-bounce-custom" style={{ animationDelay: `${i*0.15}s` }} />)}
              </div>
            ) : assistantReply}
          </motion.div>
        )}
      </div>

      {/* Medical Assistant */}
      <div className="bg-gradient-to-br from-[#1a1f2e] to-[#121828] border border-brand-danger/20 rounded-brand p-6 space-y-4 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-danger to-transparent opacity-50" />
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-danger/10 border border-brand-danger/25 rounded-xl flex items-center justify-center">
            <Stethoscope className="text-brand-danger" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#ff9a9a]">Symptom Assistant</h3>
            <p className="text-[10px] text-brand-muted">Describe your symptoms for guidance</p>
          </div>
        </div>

        <div className="bg-brand-warn/5 border border-brand-warn/20 rounded-lg p-2.5 text-[10px] text-brand-warn/80 leading-relaxed flex items-start gap-2">
          <Info size={14} className="flex-shrink-0 mt-0.5" />
          Not professional medical advice. Consult a doctor for diagnosis.
        </div>

        <div className="flex flex-wrap gap-2">
          {['Headache + fever', 'Chest pain', 'Back pain', 'Eye strain', 'Stress'].map(s => (
            <button 
              key={s} 
              onClick={() => setMedicalInput(`I have ${s}`)}
              className="text-[10px] px-3 py-1.5 rounded-full bg-brand-danger/10 border border-brand-danger/20 text-[#ff9a9a] hover:bg-brand-danger/20 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex gap-2 items-end">
          <textarea 
            value={medicalInput}
            onChange={(e) => setMedicalInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleMedicalAsk())}
            placeholder="e.g. My eyes feel tired after working for 2 hours..."
            className="flex-1 bg-white/5 border border-brand-danger/20 rounded-xl px-4 py-3 text-sm outline-none focus:border-brand-danger transition-colors resize-none h-20"
          />
          <button 
            onClick={handleMedicalAsk}
            disabled={!medicalInput.trim()}
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-brand-danger to-[#c94444] flex items-center justify-center shadow-lg shadow-brand-danger/20 disabled:opacity-50"
          >
            <Send className="text-white" size={20} />
          </button>
        </div>

        {medicalReply && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/5 border border-brand-danger/10 rounded-xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-[#ff9a9a] uppercase tracking-wider">AI Guidance</span>
              {medicalReply.urgency && (
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  medicalReply.urgency === 'EMERGENCY' ? 'bg-brand-danger/20 text-brand-danger border border-brand-danger/30' : 
                  medicalReply.urgency === 'SOON' ? 'bg-brand-warn/20 text-brand-warn border border-brand-warn/30' : 
                  'bg-brand-accent/20 text-brand-accent border border-brand-accent/30'
                }`}>
                  {medicalReply.urgency}
                </span>
              )}
            </div>
            <div className="text-sm text-brand-text leading-relaxed">
              {medicalReply.text === 'Checking symptoms...' ? (
                <div className="flex gap-1 items-center">
                  {[1,2,3].map(i => <div key={i} className="w-1 h-1 rounded-full bg-brand-danger animate-bounce-custom" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
              ) : medicalReply.text}
            </div>
            {medicalReply.text !== 'Checking symptoms...' && (
              <button 
                onClick={() => speak(medicalReply.text)}
                className="text-[10px] font-bold text-[#ff9a9a] flex items-center gap-1.5 hover:underline"
              >
                <Volume2 size={12} /> Read aloud
              </button>
            )}
          </motion.div>
        )}
      </div>

      {/* Prescription Reader */}
      <div className="bg-gradient-to-br from-[#1a2535] to-[#0f1929] border border-brand-accent2/20 rounded-brand p-6 space-y-4 relative overflow-hidden backdrop-blur-sm">
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-brand-accent2 to-transparent opacity-50" />
        
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-accent2/10 border border-brand-accent2/25 rounded-xl flex items-center justify-center">
            <FileText className="text-brand-accent2" size={20} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#9acbff]">Prescription Reader</h3>
            <p className="text-[10px] text-brand-muted">Scan prescription for insights</p>
          </div>
        </div>

        {!prescriptionImage ? (
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="group cursor-pointer border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 hover:border-brand-accent2/40 hover:bg-brand-accent2/5 transition-all"
          >
            <div className="w-12 h-12 rounded-full bg-brand-accent2/10 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Camera className="text-brand-accent2" size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-brand-text">Take a photo or upload</p>
              <p className="text-[10px] text-brand-muted mt-1">Legible text works best</p>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              capture="environment"
              onChange={handlePrescriptionUpload}
              className="hidden" 
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-white/10 group">
              <img src={prescriptionImage} alt="Prescription" className="w-full h-40 object-cover" />
              <button 
                onClick={() => setPrescriptionImage(null)}
                className="absolute top-2 right-2 p-2 bg-brand-danger/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 size={16} />
              </button>
              {isAnalyzingPrescription && (
                <div className="absolute inset-0 bg-brand-bg/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                  <Loader2 className="text-brand-accent2 animate-spin" size={24} />
                  <span className="text-xs font-bold text-brand-accent2 uppercase tracking-widest">Analyzing...</span>
                </div>
              )}
            </div>

            {prescriptionAnalysis && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white/5 border border-brand-accent2/10 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-brand-accent2 uppercase tracking-wider">AI Insights</span>
                  {prescriptionAnalysis.urgency && (
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      prescriptionAnalysis.urgency === 'EMERGENCY' ? 'bg-brand-danger/20 text-brand-danger border border-brand-danger/30' : 
                      prescriptionAnalysis.urgency === 'SOON' ? 'bg-brand-warn/20 text-brand-warn border border-brand-warn/30' : 
                      'bg-brand-accent/20 text-brand-accent border border-brand-accent/30'
                    }`}>
                      {prescriptionAnalysis.urgency}
                    </span>
                  )}
                </div>
                <div className="text-sm text-brand-text leading-relaxed whitespace-pre-line">
                  {prescriptionAnalysis.text}
                </div>
                <button 
                  onClick={() => speak(prescriptionAnalysis.text)}
                  className="text-[10px] font-bold text-brand-accent2 flex items-center gap-1.5 hover:underline"
                >
                  <Volume2 size={12} /> Read aloud
                </button>
              </motion.div>
            )}
            
            {!isAnalyzingPrescription && !prescriptionAnalysis && (
              <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="w-full py-2.5 rounded-xl border border-white/10 text-brand-muted text-xs font-medium hover:bg-white/5 flex items-center justify-center gap-2"
              >
                <Upload size={14} /> Upload another image
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-brand-card border border-white/5 rounded-brand p-4 text-center">
          <div className="font-syne text-2xl font-bold text-brand-accent">{completedSessions}</div>
          <div className="text-[10px] text-brand-muted uppercase tracking-wider mt-1">Breaks</div>
        </div>
        <div className="bg-brand-card border border-white/5 rounded-brand p-4 text-center">
          <div className="font-syne text-2xl font-bold text-brand-text">{completedSessions}h</div>
          <div className="text-[10px] text-brand-muted uppercase tracking-wider mt-1">Tracked</div>
        </div>
        <div className="bg-brand-card border border-white/5 rounded-brand p-4 text-center">
          <div className="font-syne text-2xl font-bold text-brand-accent2">{Math.min(completedSessions, 7)}</div>
          <div className="text-[10px] text-brand-muted uppercase tracking-wider mt-1">Streak</div>
        </div>
      </div>

      {/* Daily report */}
      <div className="bg-brand-card border border-white/5 rounded-brand p-5 space-y-4">
        <h3 className="text-[10px] font-bold text-brand-muted uppercase tracking-widest">Daily Wellness Report</h3>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-brand-muted leading-relaxed min-h-[44px]">
          {dailyReport}
        </div>
        <button 
          onClick={generateDailyReport}
          className="text-xs font-bold text-brand-accent2 bg-brand-accent2/10 border border-brand-accent2/20 px-4 py-2 rounded-full hover:bg-brand-accent2/15 transition-colors"
        >
          Generate fresh report
        </button>
      </div>

    </div>
  );
}
