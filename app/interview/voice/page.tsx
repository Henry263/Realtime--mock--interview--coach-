'use client';

import { useEffect, useRef, useState } from 'react';

const VoiceInterviewPage = () => {
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [status, setStatus] = useState<'speaking' | 'listening' | 'waiting'>('waiting');
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem('questions');
    if (stored) setQuestions(JSON.parse(stored));
  }, []);

  useEffect(() => {
    if (questions.length > 0 && currentIndex < questions.length) {
      speakAndListen(questions[currentIndex]);
    }
  }, [questions, currentIndex]);

  const speakAndListen = (text: string) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    setStatus('speaking');

    utterance.onend = () => {
      setStatus('listening');
      startListening();
    };

    speechSynthesis.speak(utterance);
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setAnswers((prev) => [...prev, transcript]);
      setStatus('waiting');
      setCurrentIndex((prev) => prev + 1);
    };

    recognition.onerror = () => {
      setAnswers((prev) => [...prev, '[No response / error]']);
      setStatus('waiting');
      setCurrentIndex((prev) => prev + 1);
    };

    recognition.onend = () => {
      if (status === 'listening') {
        setAnswers((prev) => [...prev, '[No response]']);
        setStatus('waiting');
        setCurrentIndex((prev) => prev + 1);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  useEffect(() => {
    if (currentIndex >= questions.length && !summary && !isSummarizing) {
      setIsSummarizing(true);
      fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, answers }),
      })
        .then(res => res.json())
        .then(data => setSummary(data.summary))
        .catch(() => setSummary('Failed to generate summary.'));
    }
  }, [currentIndex]);

  const handleCopyTranscript = () => {
    const transcript = questions
      .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`)
      .join('\n\n');

    navigator.clipboard.writeText(transcript)
      .then(() => alert('Transcript copied to clipboard!'))
      .catch(() => alert('Failed to copy transcript.'));
  };

  if (currentIndex >= questions.length) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-green-600 mb-6">✅ Interview Complete</h2>

        <div className="text-left bg-gray-100 p-6 rounded shadow">
          {questions.map((q, i) => (
            <div key={i} className="mb-5">
              <p className="font-semibold text-gray-800">Q{i + 1}: {q}</p>
              <p className="text-gray-600 mt-1">A{i + 1}: {answers[i]}</p>
            </div>
          ))}
        </div>

        <button
          onClick={handleCopyTranscript}
          className="mt-4 bg-gray-800 hover:bg-black text-white text-sm px-4 py-2 rounded transition"
        >
          📋 Copy Transcript
        </button>

        {summary ? (
          <div className="mt-8 p-4 border rounded bg-white shadow-md text-left">
            <h3 className="text-lg font-bold text-blue-700 mb-2">📋 AI Feedback Summary</h3>
            <pre className="whitespace-pre-wrap text-gray-800 text-sm">{summary}</pre>
          </div>
        ) : (
          <div className="mt-8 text-blue-500 animate-pulse">⏳ Generating AI feedback summary...</div>
        )}
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col justify-center items-center bg-black text-white text-center transition-all duration-300">
      {status === 'speaking' && (
        <>
          <div className="text-2xl sm:text-4xl font-bold mb-6 animate-pulse">🎤 Asking the Question...</div>
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full bg-blue-500 opacity-70 animate-ping"></div>
            <div className="absolute inset-2 rounded-full bg-blue-600"></div>
          </div>
        </>
      )}

      {status === 'listening' && (
        <>
          <div className="text-2xl sm:text-4xl font-bold mb-6 animate-pulse text-green-400">🎧 Listening...</div>
          <div className="relative w-32 h-32">
            <div className="absolute inset-0 rounded-full bg-green-400 opacity-70 animate-ping"></div>
            <div className="absolute inset-2 rounded-full bg-green-600"></div>
          </div>
        </>
      )}

      {status === 'waiting' && (
        <div className="text-xl sm:text-2xl font-medium text-gray-300 animate-pulse">
          ⏳ Preparing next question...
        </div>
      )}
    </div>
  );
};

export default VoiceInterviewPage;
