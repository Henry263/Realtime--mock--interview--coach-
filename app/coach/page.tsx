'use client';

import { useEffect, useRef, useState } from 'react';
import '../globals.css';

interface QAEntry {
  id: number;
  question: string;
  answer: string | null;
  followUp: string | null;
  timestamp: Date;
  tone: Tone;
  detectedTone: Tone | null;
  wasAutoDetected: boolean;
}

type AudioMode = 'microphone' | 'tab';
type CaptureMode = 'auto' | 'push-to-talk' | 'manual';
type Tone = 'general' | 'technical' | 'behavioral' | 'system-design' | 'coding' | 'auto';
type AnswerFormat = 'prose' | 'bullets' | 'structured';
type Duration = 15 | 30 | 45 | 60;
type AnswerLength = 'short' | 'medium' | 'long' | 'extra-long';

const toneConfig: Record<Exclude<Tone, 'auto'>, { label: string; emoji: string; color: string; shortcut: string }> = {
  general: { label: 'General', emoji: '💬', color: 'bg-gray-600', shortcut: 'G' },
  technical: { label: 'Technical', emoji: '⚙️', color: 'bg-blue-600', shortcut: 'T' },
  behavioral: { label: 'Behavioral', emoji: '🤝', color: 'bg-purple-600', shortcut: 'B' },
  'system-design': { label: 'System Design', emoji: '🏗️', color: 'bg-orange-600', shortcut: 'S' },
  coding: { label: 'Coding', emoji: '💻', color: 'bg-green-600', shortcut: 'C' },
};

const formatConfig: Record<AnswerFormat, { label: string; emoji: string; description: string }> = {
  prose: { label: 'Conversational', emoji: '💬', description: 'Natural sentences to speak aloud' },
  bullets: { label: 'Bullet Points', emoji: '•', description: 'Key points for quick scanning' },
  structured: { label: 'Structured', emoji: '📋', description: 'Opening → Points → Conclusion' },
};

const durationConfig: Record<Duration, { label: string; description: string }> = {
  15: { label: '15 min', description: 'Very concise (1-2 sentences)' },
  30: { label: '30 min', description: 'Concise (2-3 sentences)' },
  45: { label: '45 min', description: 'Moderate detail (2-4 sentences)' },
  60: { label: '60 min', description: 'More detail (3-5 sentences)' },
};

const lengthConfig: Record<AnswerLength, { label: string; emoji: string; description: string }> = {
  'short': { label: 'Short', emoji: '📝', description: '30-50 words (~2 sentences)' },
  'medium': { label: 'Medium', emoji: '📄', description: '60-100 words (~4 sentences)' },
  'long': { label: 'Long', emoji: '📋', description: '120-180 words (~6 sentences)' },
  'extra-long': { label: 'Extra Long', emoji: '📚', description: '200-300 words (~10 sentences)' },
};

const captureModeConfig: Record<CaptureMode, { label: string; emoji: string; description: string }> = {
  'auto': { label: 'Auto', emoji: '🤖', description: 'AI filters questions vs your answers' },
  'push-to-talk': { label: 'Push-to-Talk', emoji: '🎯', description: 'Hold SPACE when interviewer asks' },
  'manual': { label: 'Manual', emoji: '⌨️', description: 'Type questions manually only' },
};

export default function CoachPage() {
  const [isListening, setIsListening] = useState(false);
  const [audioMode, setAudioMode] = useState<AudioMode>('microphone');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('auto');
  const [isPaused, setIsPaused] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false); // For push-to-talk
  const [tone, setTone] = useState<Tone>('auto');
  const [autoDetect, setAutoDetect] = useState(true);
  const [format, setFormat] = useState<AnswerFormat>('prose');
  const [duration, setDuration] = useState<Duration>(30);
  const [answerLength, setAnswerLength] = useState<AnswerLength>('medium');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'listening' | 'processing' | 'paused'>('idle');
  const [transcript, setTranscript] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [entries, setEntries] = useState<QAEntry[]>([]);
  const [context, setContext] = useState('');
  const [jobRequirements, setJobRequirements] = useState('');
  const [cv, setCv] = useState('');
  const [showSettings, setShowSettings] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcriptBuffer, setTranscriptBuffer] = useState<string[]>([]); // Rolling buffer
  const [isRecordingChunk, setIsRecordingChunk] = useState(false); // For Whisper recording
  
  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const entryIdRef = useRef(0);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bufferTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef('');
  const toneRef = useRef<Tone>('auto');
  const formatRef = useRef<AnswerFormat>('prose');
  const durationRef = useRef<Duration>(30);
  const answerLengthRef = useRef<AnswerLength>('medium');
  const captureModeRef = useRef<CaptureMode>('auto');
  const isPausedRef = useRef(false);
  const isCapturingRef = useRef(false);

  // Keep refs in sync with state
  useEffect(() => { toneRef.current = tone; }, [tone]);
  useEffect(() => { formatRef.current = format; }, [format]);
  useEffect(() => { captureModeRef.current = captureMode; }, [captureMode]);
  useEffect(() => { isPausedRef.current = isPaused; }, [isPaused]);
  useEffect(() => { isCapturingRef.current = isCapturing; }, [isCapturing]);
  useEffect(() => { durationRef.current = duration; }, [duration]);
  useEffect(() => { answerLengthRef.current = answerLength; }, [answerLength]);

  // Toggle pause
  const togglePause = () => {
    if (isPaused) {
      setIsPaused(false);
      setStatus('listening');
    } else {
      setIsPaused(true);
      setStatus('paused');
      // Clear any pending transcript
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    }
  };

  // Cycle capture mode
  const cycleMode = () => {
    const modes: CaptureMode[] = ['auto', 'push-to-talk', 'manual'];
    const currentIndex = modes.indexOf(captureMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setCaptureMode(modes[nextIndex]);
  };

  // Add to transcript buffer (rolling window of last 10 entries)
  const addToBuffer = (text: string) => {
    if (!text.trim()) return;
    setTranscriptBuffer(prev => {
      const newBuffer = [...prev, text.trim()];
      // Keep last 10 chunks (roughly 30 seconds)
      return newBuffer.slice(-10);
    });
  };

  // Grab and submit buffer immediately
  const grabAndAsk = () => {
    const bufferText = transcriptBuffer.join(' ').trim();
    const currentText = transcript.trim();
    const combined = `${bufferText} ${currentText}`.trim();
    
    if (combined.length > 10) {
      processQuestion(combined, true); // Skip question check
      setTranscriptBuffer([]);
      setTranscript('');
      finalTranscriptRef.current = '';
    }
  };

  // Clear buffer
  const clearBuffer = () => {
    setTranscriptBuffer([]);
    setTranscript('');
    finalTranscriptRef.current = '';
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const key = e.key.toUpperCase();
      
      // SPACE - Push-to-talk (start capturing)
      if (e.code === 'Space' && isListening && captureMode === 'push-to-talk' && !isCapturing) {
        e.preventDefault();
        setIsCapturing(true);
        finalTranscriptRef.current = '';
        setTranscript('');
        return;
      }
      
      // ENTER - Grab & Ask (instant submit buffer)
      if (e.key === 'Enter' && isListening && !isPaused) {
        e.preventDefault();
        grabAndAsk();
        return;
      }
      
      // ESCAPE or X - Clear buffer
      if ((e.key === 'Escape' || key === 'X') && isListening) {
        e.preventDefault();
        clearBuffer();
        return;
      }
      
      // P - Pause/Resume
      if (key === 'P' && isListening) {
        e.preventDefault();
        togglePause();
        return;
      }
      
      // M - Cycle capture mode
      if (key === 'M') {
        e.preventDefault();
        cycleMode();
        return;
      }
      
      // Tone shortcuts (only work when not listening to avoid conflicts)
      if (!isListening || e.shiftKey) {
        if (key === 'A') { setTone('auto'); setAutoDetect(true); }
        else if (key === 'G') { setTone('general'); setAutoDetect(false); }
        else if (key === 'T') { setTone('technical'); setAutoDetect(false); }
        else if (key === 'B') { setTone('behavioral'); setAutoDetect(false); }
        else if (key === 'S') { setTone('system-design'); setAutoDetect(false); }
        else if (key === 'C') { setTone('coding'); setAutoDetect(false); }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // SPACE released - stop capturing and process
      if (e.code === 'Space' && isListening && captureMode === 'push-to-talk' && isCapturing) {
        e.preventDefault();
        setIsCapturing(false);
        if (finalTranscriptRef.current.trim().length > 10) {
          processQuestion(finalTranscriptRef.current.trim());
        }
        finalTranscriptRef.current = '';
        setTranscript('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isListening, captureMode, isCapturing, isPaused]);

  // Process transcript and get AI coaching
  const processQuestion = async (question: string, skipQuestionCheck = false) => {
    if (!question.trim() || question.length < 10) return;
    
    const currentTone = toneRef.current;
    const currentFormat = formatRef.current;
    const currentDuration = durationRef.current;
    const currentAnswerLength = answerLengthRef.current;
    const currentCaptureMode = captureModeRef.current;
    setStatus('processing');
    const entryId = ++entryIdRef.current;
    const isAutoMode = currentTone === 'auto';
    
    // In auto mode, first check if this is actually a question (not our own answer)
    if (currentCaptureMode === 'auto' && !skipQuestionCheck) {
      try {
        const checkRes = await fetch('/api/coach/check-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: question }),
        });
        const checkData = await checkRes.json();
        
        if (!checkData.isQuestion) {
          // Not a question, ignore it
          setStatus('listening');
          return;
        }
      } catch (err) {
        // If check fails, proceed anyway
        console.warn('Question check failed, proceeding anyway');
      }
    }
    
    // Add question immediately (tone will be updated when response comes)
    const newEntry: QAEntry = {
      id: entryId,
      question: question.trim(),
      answer: null,
      followUp: null,
      timestamp: new Date(),
      tone: isAutoMode ? 'general' : currentTone as Exclude<Tone, 'auto'>,
      detectedTone: null,
      wasAutoDetected: isAutoMode,
    };
    setEntries(prev => [newEntry, ...prev]);

    try {
      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question, 
          context, 
          jobRequirements,
          cv,
          tone: currentTone,
          format: currentFormat,
          duration: currentDuration,
          answerLength: currentAnswerLength,
          autoDetect: isAutoMode
        }),
      });
      
      const data = await res.json();
      
      if (data.response) {
        // Parse response to extract answer and follow-up
        const response = data.response;
        const answerMatch = response.match(/\*\*ANSWER\*\*[:\s]*([\s\S]*?)(?=\*\*FOLLOW-UP\*\*|2\.|$)/i);
        const followUpMatch = response.match(/\*\*FOLLOW-UP\*\*[:\s]*([\s\S]*?)$/i);
        
        setEntries(prev => prev.map(e => 
          e.id === entryId 
            ? { 
                ...e, 
                answer: answerMatch ? answerMatch[1].trim() : response,
                followUp: followUpMatch ? followUpMatch[1].trim() : null,
                tone: data.usedTone || e.tone,
                detectedTone: data.detectedTone || null,
              }
            : e
        ));
      }
    } catch (err) {
      setEntries(prev => prev.map(e => 
        e.id === entryId ? { ...e, answer: 'Error generating response' } : e
      ));
    }
    
    setStatus('listening');
  };

  // Setup speech recognition
  const setupRecognition = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    
    if (!SpeechRecognition) {
      throw new Error('Speech recognition not supported. Please use Chrome or Edge.');
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      // Skip if paused or in manual mode
      if (isPausedRef.current || captureModeRef.current === 'manual') {
        return;
      }
      
      // In push-to-talk mode, only process if capturing
      if (captureModeRef.current === 'push-to-talk' && !isCapturingRef.current) {
        return;
      }
      
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += transcript + ' ';
        } else {
          interimTranscript = transcript;
        }
      }
      
      setTranscript(finalTranscriptRef.current + interimTranscript);
      
      // In push-to-talk mode, don't auto-process (wait for key release)
      if (captureModeRef.current === 'push-to-talk') {
        return;
      }
      
      // Add completed sentences to buffer for "grab and ask" feature
      if (finalTranscriptRef.current.trim().length > 10) {
        // Add to buffer every time we get a decent chunk
        if (bufferTimerRef.current) {
          clearTimeout(bufferTimerRef.current);
        }
        bufferTimerRef.current = setTimeout(() => {
          if (finalTranscriptRef.current.trim()) {
            setTranscriptBuffer(prev => {
              const newBuffer = [...prev, finalTranscriptRef.current.trim()];
              return newBuffer.slice(-10);
            });
          }
        }, 500);
      }
      
      // Reset silence timer (auto mode) - FASTER at 1.5s
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      silenceTimerRef.current = setTimeout(() => {
        if (finalTranscriptRef.current.trim().length > 15) {
          processQuestion(finalTranscriptRef.current.trim());
          finalTranscriptRef.current = '';
          setTranscript('');
        }
      }, 1500); // Process after 1.5 seconds of silence (was 2.5s)
    };

    recognition.onerror = (event: any) => {
      // "no-speech" is normal - just means silence detected, restart quietly
      if (event.error === 'no-speech') {
        if (isListening) {
          try {
            recognition.start();
          } catch (e) {
            // Ignore if already started
          }
        }
        return;
      }
      
      // "aborted" is also normal when stopping
      if (event.error === 'aborted') {
        return;
      }
      
      // Handle actual errors silently (no console logging to avoid Next.js error overlay)
      if (event.error === 'network') {
        setError('Network error: Speech recognition requires internet connection. Check your connection and try again.');
        // Auto-retry after a delay
        setTimeout(() => {
          if (isListening) {
            try {
              recognition.start();
            } catch (e) {
              // Ignore
            }
          }
        }, 2000);
      } else if (event.error === 'audio-capture') {
        setError('Audio capture failed. Please check microphone permissions and try again.');
      } else if (event.error === 'not-allowed') {
        setError('Microphone access denied. Please allow microphone access in browser settings.');
      } else {
        setError(`Recognition error: ${event.error}. Try refreshing the page.`);
      }
    };

    recognition.onend = () => {
      // Restart if still listening
      if (isListening) {
        try {
          recognition.start();
        } catch (e) {
          // Ignore if already started
        }
      }
    };

    return recognition;
  };

  // Start listening via MICROPHONE (for desktop apps)
  const startMicrophoneListening = async () => {
    setError(null);
    setStatus('connecting');
    
    try {
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      
      const recognition = setupRecognition();
      recognitionRef.current = recognition;
      recognition.start();
      
      setIsListening(true);
      setStatus('listening');
      setShowSettings(false);

    } catch (err: any) {
      console.error('Error starting microphone:', err);
      setError(err.message || 'Failed to access microphone. Please allow microphone access.');
      setStatus('idle');
    }
  };

  // Start listening via TAB AUDIO (for browser calls)
  // NOTE: Web Speech API still uses microphone even in tab mode!
  // Tab sharing is mainly to keep the tab active, speech comes from mic
  const startTabListening = async () => {
    setError(null);
    setStatus('connecting');
    
    try {
      // Request screen share with audio to capture system sound
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
      });

      // Check if audio track exists
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length === 0) {
        displayStream.getTracks().forEach(t => t.stop());
        // Show warning but continue with microphone
        setError('⚠️ No audio track shared. Using your microphone instead. Make sure speakers are on so mic can hear the call.');
      }

      mediaStreamRef.current = displayStream;

      // Create audio context
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(displayStream);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);

      const recognition = setupRecognition();
      recognitionRef.current = recognition;
      recognition.start();
      
      setIsListening(true);
      setStatus('listening');
      setShowSettings(false);

      // Handle stream ending
      displayStream.getVideoTracks()[0].onended = () => {
        stopListening();
      };

    } catch (err: any) {
      console.error('Error starting tab audio:', err);
      setError(err.message || 'Failed to start. Make sure to share your screen with audio.');
      setStatus('idle');
    }
  };

  const startListening = () => {
    finalTranscriptRef.current = '';
    if (audioMode === 'microphone') {
      startMicrophoneListening();
    } else {
      startTabListening();
    }
  };

  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    setIsListening(false);
    setStatus('idle');
    setTranscript('');
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Manual submit for typed questions
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prefer manual input, fall back to transcript
    const question = manualInput.trim() || transcript.trim();
    if (question) {
      processQuestion(question);
      setManualInput('');
      setTranscript('');
      finalTranscriptRef.current = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-green-400">🎯 Real-Time Mock Interview Coach</h1>
            <p className="text-sm text-gray-400">Instant answers for live interviews</p>
          </div>
          
          <div className="flex items-center gap-4">
            {isListening && (
              <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
                {audioMode === 'microphone' ? '🎤 Mic Mode' : '🖥️ Tab Mode'}
              </span>
            )}
            <div className={`px-3 py-1 rounded-full text-sm ${
              isPaused ? 'bg-yellow-600 animate-pulse' :
              isCapturing ? 'bg-red-600 animate-pulse' :
              status === 'listening' ? 'bg-green-600 animate-pulse' :
              status === 'processing' ? 'bg-yellow-600' :
              status === 'connecting' ? 'bg-blue-600' :
              'bg-gray-600'
            }`}>
              {isPaused ? '⏸️ PAUSED' :
               isCapturing ? '🔴 CAPTURING' :
               status === 'listening' ? (captureMode === 'push-to-talk' ? '🎧 Hold SPACE' : '🎧 Listening') :
               status === 'processing' ? '🤔 Thinking...' :
               status === 'connecting' ? '🔄 Connecting...' :
               '⏸️ Idle'}
            </div>
            
            {!isListening ? (
              <button
                onClick={startListening}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold transition"
              >
                🎤 Start Coaching
              </button>
            ) : (
              <button
                onClick={stopListening}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-semibold transition"
              >
                ⏹️ Stop
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Control Bar - Capture Mode + Pause + Tone */}
      <div className="bg-gray-850 border-b border-gray-700 py-2 px-4 sticky top-0 z-10" style={{ backgroundColor: '#1a1a2e' }}>
        <div className="max-w-6xl mx-auto">
          {/* Top row: Capture Mode and Pause */}
          <div className="flex items-center gap-4 mb-2 pb-2 border-b border-gray-700">
            {/* Capture Mode */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Mode:</span>
              {(Object.keys(captureModeConfig) as CaptureMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setCaptureMode(mode)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                    captureMode === mode 
                      ? 'bg-indigo-600 text-white ring-2 ring-white/30' 
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span>{captureModeConfig[mode].emoji}</span>
                  <span>{captureModeConfig[mode].label}</span>
                </button>
              ))}
              <span className="text-xs text-gray-500 ml-2">(<kbd className="bg-gray-700 px-1 rounded">M</kbd> to cycle)</span>
            </div>

            {/* Pause/Resume Button */}
            {isListening && (
              <button
                onClick={togglePause}
                className={`ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                  isPaused
                    ? 'bg-green-600 hover:bg-green-700 text-white animate-pulse'
                    : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                }`}
              >
                {isPaused ? (
                  <>
                    <span>▶️</span>
                    <span>Resume</span>
                    <span className="text-xs opacity-70">(P)</span>
                  </>
                ) : (
                  <>
                    <span>⏸️</span>
                    <span>Pause (while I answer)</span>
                    <span className="text-xs opacity-70">(P)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Bottom row: Tone options */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 mr-2">Tone:</span>
            
            {/* Auto option */}
            <button
              onClick={() => { setTone('auto'); setAutoDetect(true); }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                tone === 'auto' 
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white ring-2 ring-white/30' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <span>🤖</span>
              <span>Auto</span>
              <span className="text-xs opacity-60 ml-1">(A)</span>
            </button>

            {/* Manual tone options */}
            {(Object.keys(toneConfig) as Exclude<Tone, 'auto'>[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTone(t); setAutoDetect(false); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
                  tone === t 
                    ? `${toneConfig[t].color} text-white ring-2 ring-white/30` 
                    : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <span>{toneConfig[t].emoji}</span>
                <span>{toneConfig[t].label}</span>
                <span className="text-xs opacity-60 ml-1">({toneConfig[t].shortcut})</span>
              </button>
            ))}

            {/* Quick length selector */}
            <div className="ml-auto flex items-center gap-2">
              <span className="text-xs text-gray-500">📏 Length:</span>
              {(Object.keys(lengthConfig) as AnswerLength[]).map((len) => (
                <button
                  key={len}
                  onClick={() => setAnswerLength(len)}
                  className={`px-2 py-1 rounded text-xs transition ${
                    answerLength === len
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                  title={lengthConfig[len].description}
                >
                  {lengthConfig[len].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Instructions Panel - Collapsible */}
      {isListening && showInstructions && (
        <div className="bg-gradient-to-r from-blue-900/40 to-purple-900/40 border-b border-gray-700 py-3 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">📖</span>
                  <span className="text-sm font-semibold text-white">Quick Guide - {captureModeConfig[captureMode].label} Mode</span>
                </div>
                
                {captureMode === 'auto' && (
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>• <span className="text-green-400">AI filters automatically</span> - detects questions vs your answers (1.5s pause auto-submits)</p>
                    <p>• Press <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">ENTER</kbd> to <span className="text-blue-400">instantly grab</span> buffered speech</p>
                    <p>• Press <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">P</kbd> to <span className="text-yellow-400">PAUSE</span> while you're answering, <kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">P</kbd> to resume</p>
                  </div>
                )}
                
                {captureMode === 'push-to-talk' && (
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>• <span className="text-blue-400">Hold SPACE</span> when you hear the interviewer asking a question</p>
                    <p>• <span className="text-green-400">Release SPACE</span> when they finish - answer will be generated</p>
                    <p>• Your voice is <span className="text-yellow-400">NOT captured</span> unless you hold SPACE</p>
                  </div>
                )}
                
                {captureMode === 'manual' && (
                  <div className="text-sm text-gray-300 space-y-1">
                    <p>• <span className="text-purple-400">Type questions manually</span> in the input box below</p>
                    <p>• Voice recognition is <span className="text-gray-400">disabled</span> in this mode</p>
                    <p>• Best for noisy environments or unreliable audio</p>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setShowInstructions(false)}
                className="text-gray-400 hover:text-white ml-4"
              >
                ✕ Hide
              </button>
            </div>
            
            {/* Keyboard shortcuts summary */}
            <div className="mt-3 pt-3 border-t border-gray-700/50 flex flex-wrap gap-4 text-xs text-gray-400">
              <span><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">ENTER</kbd> Grab & Ask</span>
              <span><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">X</kbd> Clear Buffer</span>
              <span><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">P</kbd> Pause/Resume</span>
              <span><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">M</kbd> Switch Mode</span>
              <span><kbd className="bg-gray-700 px-1.5 py-0.5 rounded text-white">SPACE</kbd> Push-to-Talk</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Show instructions button when hidden */}
      {isListening && !showInstructions && (
        <div className="bg-gray-800/50 border-b border-gray-700 py-1 px-4">
          <div className="max-w-6xl mx-auto">
            <button
              onClick={() => setShowInstructions(true)}
              className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
            >
              📖 Show instructions
            </button>
          </div>
        </div>
      )}

      <main className="max-w-6xl mx-auto p-4">
        {/* Status Banner when Paused or Capturing */}
        {isListening && (isPaused || isCapturing) && (
          <div className={`mb-4 p-4 rounded-lg text-center ${
            isPaused ? 'bg-yellow-900/50 border border-yellow-600' : 'bg-red-900/50 border border-red-600'
          }`}>
            {isPaused ? (
              <div>
                <p className="text-yellow-400 text-lg font-semibold">⏸️ PAUSED - Speak your answer now</p>
                <p className="text-yellow-300/70 text-sm">Press P when ready to listen for next question</p>
              </div>
            ) : (
              <div>
                <p className="text-red-400 text-lg font-semibold animate-pulse">🔴 CAPTURING - Keep holding SPACE</p>
                <p className="text-red-300/70 text-sm">Release when interviewer finishes the question</p>
              </div>
            )}
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-4">
            <p className="text-red-300">{error}</p>
          </div>
        )}

        {/* Pre-Interview Settings */}
        {showSettings && !isListening && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">⚙️ Interview Settings</h3>
              <button 
                onClick={() => setShowSettings(false)}
                className="text-xs text-gray-400 hover:text-white"
              >
                Hide settings
              </button>
            </div>

            {/* Job Requirements */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                📋 Job Requirements (optional)
              </label>
              <textarea
                value={jobRequirements}
                onChange={(e) => setJobRequirements(e.target.value)}
                placeholder="Paste the job description or key requirements here...
e.g., Looking for Senior React Developer with 5+ years experience, TypeScript, Node.js, AWS..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white text-sm"
                rows={3}
              />
            </div>

            {/* CV / Resume */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">
                📄 Your CV / Background (optional)
              </label>
              <textarea
                value={cv}
                onChange={(e) => setCv(e.target.value)}
                placeholder="Paste your CV summary or key experience...
e.g., 7 years as Full Stack Developer, led team of 5 at fintech startup, built payment systems handling $10M/month..."
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white text-sm"
                rows={3}
              />
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">⏱️ Interview Duration</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(durationConfig) as unknown as Duration[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDuration(Number(d) as Duration)}
                    className={`p-2 rounded-lg text-sm transition ${
                      duration === Number(d)
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-semibold">{durationConfig[d].label}</div>
                    <div className="text-xs opacity-70">{durationConfig[d].description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Format */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">📄 Answer Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(formatConfig) as AnswerFormat[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFormat(f)}
                    className={`p-2 rounded-lg text-sm transition ${
                      format === f
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-semibold">{formatConfig[f].emoji} {formatConfig[f].label}</div>
                    <div className="text-xs opacity-70">{formatConfig[f].description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Length */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">📏 Answer Length</label>
              <div className="grid grid-cols-4 gap-2">
                {(Object.keys(lengthConfig) as AnswerLength[]).map((len) => (
                  <button
                    key={len}
                    onClick={() => setAnswerLength(len)}
                    className={`p-2 rounded-lg text-sm transition ${
                      answerLength === len
                        ? 'bg-blue-600 text-white ring-2 ring-blue-400'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    <div className="font-semibold">{lengthConfig[len].emoji} {lengthConfig[len].label}</div>
                    <div className="text-xs opacity-70">{lengthConfig[len].description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto-detect toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
              <div>
                <div className="text-sm font-medium text-white">🤖 Auto-detect question type</div>
                <div className="text-xs text-gray-400">AI will detect if question is technical, behavioral, etc.</div>
              </div>
              <button
                onClick={() => {
                  setAutoDetect(!autoDetect);
                  setTone(autoDetect ? 'general' : 'auto');
                }}
                className={`w-12 h-6 rounded-full transition-colors ${
                  autoDetect ? 'bg-green-500' : 'bg-gray-600'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                  autoDetect ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        )}

        {/* Collapsed settings hint */}
        {!showSettings && !isListening && (
          <button 
            onClick={() => setShowSettings(true)}
            className="text-sm text-gray-400 hover:text-white mb-4 flex items-center gap-2 flex-wrap"
          >
            ⚙️ Show settings ({lengthConfig[answerLength].label} answers, {formatConfig[format].label})
            {jobRequirements && <span className="text-green-400">✓ JD</span>}
            {cv && <span className="text-blue-400">✓ CV</span>}
          </button>
        )}

        {/* Audio Mode Selector */}
        {!isListening && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4">
            <label className="block text-sm text-gray-400 mb-3">🎧 Select Audio Source</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setAudioMode('microphone')}
                className={`p-4 rounded-lg border-2 transition text-left ${
                  audioMode === 'microphone'
                    ? 'border-green-500 bg-green-900/30'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="text-lg mb-1">🎤 Microphone</div>
                <div className="text-xs text-gray-400">
                  For <span className="text-yellow-400 font-semibold">Desktop Apps</span> (Teams, Zoom)
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Uses your mic to hear the speaker
                </div>
              </button>
              <button
                onClick={() => setAudioMode('tab')}
                className={`p-4 rounded-lg border-2 transition text-left ${
                  audioMode === 'tab'
                    ? 'border-green-500 bg-green-900/30'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                }`}
              >
                <div className="text-lg mb-1">🖥️ Tab Audio</div>
                <div className="text-xs text-gray-400">
                  For <span className="text-blue-400 font-semibold">Browser Calls</span> (Web Teams/Zoom)
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Captures audio directly from browser
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!isListening && entries.length === 0 && (
          <div className="bg-gray-800 rounded-lg p-6 mb-4">
            <h2 className="text-lg font-semibold mb-4 text-yellow-400">📋 How to Use</h2>
            
            {audioMode === 'microphone' ? (
              <>
                <ol className="space-y-2 text-gray-300 text-sm">
                  <li>1. Join your Teams/Zoom <span className="text-yellow-400">desktop app</span> call</li>
                  <li>2. Make sure your <span className="text-green-400">speakers are on</span> (not headphones for best results)</li>
                  <li>3. Click <span className="text-green-400 font-semibold">"Start Coaching"</span></li>
                  <li>4. Allow microphone access when prompted</li>
                  <li>5. When interviewer asks a question, answers appear here!</li>
                </ol>
                <div className="mt-4 p-3 bg-green-900/30 border border-green-600/50 rounded-lg">
                  <p className="text-green-300 text-sm">
                    💡 <strong>Tip:</strong> Position your mic to pick up the speaker audio clearly. Using external speakers works better than laptop speakers.
                  </p>
                </div>
              </>
            ) : (
              <>
                <ol className="space-y-2 text-gray-300 text-sm">
                  <li>1. Join your Teams/Zoom call <span className="text-blue-400">in the browser</span></li>
                  <li>2. Click <span className="text-green-400 font-semibold">"Start Coaching"</span></li>
                  <li>3. Select the browser tab with your call</li>
                  <li>4. <span className="text-yellow-400 font-semibold">Important:</span> Check "Share audio" checkbox</li>
                  <li>5. When interviewer asks a question, answers appear here!</li>
                </ol>
                <div className="mt-4 p-3 bg-yellow-900/30 border border-yellow-600/50 rounded-lg">
                  <p className="text-yellow-300 text-sm">
                    ⚠️ <strong>Known Limitation:</strong> Browser speech recognition still uses your <strong>microphone</strong> even in Tab Audio mode. 
                    For best results, use <strong>Microphone mode</strong> with speakers on, or use <strong>Manual mode</strong> to type questions.
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Manual Question Input - Always visible when listening */}
        {isListening && (
          <div className="bg-gray-800 rounded-lg p-4 mb-4 border-2 border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  {audioMode === 'microphone' ? '🎤 Listening via Microphone' : '🖥️ Listening via Tab Audio'}
                </span>
                {transcript && (
                  <span className="text-xs text-green-400 animate-pulse">
                    Heard something...
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">Auto-submits after 1.5s pause • Press <kbd className="bg-gray-700 px-1 rounded">ENTER</kbd> to grab now</span>
            </div>
            
            {/* Buffer display - shows captured audio history */}
            {transcriptBuffer.length > 0 && (
              <div className="bg-blue-900/30 rounded-lg p-3 mb-3 border border-blue-600/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-blue-400 flex items-center gap-1">
                    📦 Buffer ({transcriptBuffer.length} chunks)
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={clearBuffer}
                      className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-700 hover:bg-gray-600"
                    >
                      ✕ Clear
                    </button>
                    <button
                      onClick={grabAndAsk}
                      className="text-xs text-green-400 hover:text-white px-2 py-1 rounded bg-green-700 hover:bg-green-600 font-semibold"
                    >
                      ⚡ Grab & Ask (ENTER)
                    </button>
                  </div>
                </div>
                <p className="text-gray-300 text-sm line-clamp-3">{transcriptBuffer.join(' ')}</p>
              </div>
            )}
            
            {/* Live transcript display */}
            {transcript && (
              <div className="bg-gray-900 rounded-lg p-3 mb-3 border border-gray-600">
                <span className="text-xs text-gray-500 block mb-1">🎙️ Hearing now:</span>
                <p className="text-white">{transcript}</p>
              </div>
            )}
            
            {/* Manual input - always visible */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="Type question manually here..."
                className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!manualInput.trim() && !transcript.trim()}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-6 py-3 rounded-lg transition font-semibold text-white flex items-center gap-2"
              >
                <span>🎯</span>
                <span>Ask</span>
              </button>
            </form>
            <p className="text-xs text-gray-500 mt-2">
              💡 Tip: Press <kbd className="bg-gray-700 px-1 rounded">ENTER</kbd> to instantly grab buffered text, or <kbd className="bg-gray-700 px-1 rounded">X</kbd> to clear
            </p>
          </div>
        )}

        {/* Q&A Entries */}
        <div className="space-y-4">
          {entries.map((entry) => {
            const displayTone = entry.tone === 'auto' ? 'general' : entry.tone;
            const toneInfo = toneConfig[displayTone as Exclude<Tone, 'auto'>];
            
            return (
              <div key={entry.id} className="bg-gray-800 rounded-lg overflow-hidden">
                {/* Question */}
                <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
                  <div className="flex items-start justify-between">
                    <p className="text-gray-300 font-medium">❓ {entry.question}</p>
                    <div className="flex items-center gap-2">
                      {entry.wasAutoDetected && entry.detectedTone && (
                        <span className="text-xs text-gray-400">
                          🤖 Auto →
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded ${toneInfo.color}`}>
                        {toneInfo.emoji} {toneInfo.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {entry.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Answer */}
                <div className="p-4">
                  {entry.answer ? (
                    <>
                      <div className="mb-4">
                        <div className="text-green-400 text-sm font-semibold mb-2">💬 SAY THIS:</div>
                        <div className="text-white text-lg leading-relaxed whitespace-pre-wrap">
                          {entry.answer.split('\n').map((line, i) => {
                            // Handle bullet points
                            if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                              return (
                                <div key={i} className="flex items-start gap-2 my-1 ml-2">
                                  <span className="text-green-400 mt-0.5">•</span>
                                  <span>{line.trim().replace(/^[•\-]\s*/, '')}</span>
                                </div>
                              );
                            }
                            // Handle headers (bold text)
                            if (line.includes('**')) {
                              const parts = line.split(/\*\*([^*]+)\*\*/g);
                              return (
                                <div key={i} className="my-1">
                                  {parts.map((part, j) => 
                                    j % 2 === 1 
                                      ? <strong key={j} className="text-green-300">{part}</strong>
                                      : <span key={j}>{part}</span>
                                  )}
                                </div>
                              );
                            }
                            // Regular text
                            return line.trim() ? <div key={i} className="my-1">{line}</div> : <div key={i} className="h-2" />;
                          })}
                        </div>
                      </div>
                      
                      {entry.followUp && (
                        <div className="pt-3 border-t border-gray-700">
                          <div className="text-yellow-400 text-sm font-semibold mb-2">🔄 IF THEY DIG DEEPER:</div>
                          <p className="text-gray-300">{entry.followUp}</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2 text-blue-400 animate-pulse">
                      <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
                      {entry.wasAutoDetected ? 'Detecting question type & generating answer...' : 'Generating answer...'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Empty state */}
        {isListening && entries.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <div className="text-4xl mb-4">{audioMode === 'microphone' ? '🎤' : '🎧'}</div>
            <p>
              {audioMode === 'microphone' 
                ? 'Listening through your microphone...' 
                : 'Listening for interview questions...'}
            </p>
            <p className="text-sm mt-2">Answers will appear here instantly</p>
            {tone === 'auto' && (
              <p className="text-xs mt-2 text-purple-400">🤖 Auto-detect is ON - will adapt to question type</p>
            )}
            {audioMode === 'microphone' && (
              <p className="text-xs mt-4 text-gray-600">
                Make sure your speakers are audible to the mic
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
