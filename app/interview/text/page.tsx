'use client';

import { useEffect, useState } from 'react';
import "../../globals.css";

export default function InterviewPage() {
  const [questions, setQuestions] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [input, setInput] = useState('');
  const [answers, setAnswers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showQuestion, setShowQuestion] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('questions');
    if (stored) {
      setQuestions(JSON.parse(stored));
      setTimeout(() => {
        setShowQuestion(true);
        setIsLoading(false);
      }, 500);
    } else {
      setIsLoading(false);
    }
  }, []);

  const handleNext = () => {
    if (!input.trim()) return;
    setAnswers((prev) => [...prev, input]);
    setInput('');
    setShowQuestion(false);
    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setShowQuestion(true);
    }, 400);
  };

  useEffect(() => {
    if (currentIndex >= questions.length && !summary && !isSummarizing) {
      setIsSummarizing(true);
      fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions, answers }),
      })
        .then((res) => res.json())
        .then((data) => setSummary(data.summary))
        .catch(() => setSummary('Failed to generate summary.'));
    }
  }, [currentIndex]);

  const handleCopyTranscript = () => {
    const transcript = questions
      .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`)
      .join('\n\n');

    navigator.clipboard.writeText(transcript)
      .then(() => alert('📋 Transcript copied to clipboard!'))
      .catch(() => alert(' Failed to copy transcript.'));
  }

  if (isLoading) return <p className="p-4 text-center text-gray-600">Preparing interview...</p>;
  if (!questions.length) return <p className="p-4 text-center text-red-500">No questions found.</p>;

  if (currentIndex >= questions.length) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <h2 className="text-3xl font-bold text-green-600 mb-6">✅ Interview Complete</h2>
        <p className="mb-6 text-gray-700">Thanks for your time! Below is your Q&A summary:</p>

        <div className="bg-gray-50 p-4 rounded-md text-left shadow">
          {questions.map((q, i) => (
            <div key={i} className="mb-4">
              <p className="font-medium text-gray-800">Q{i + 1}: {q}</p>
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
    <div className="p-6 max-w-2xl mx-auto">
      <div className="mb-4 text-sm text-gray-500">
        Question {currentIndex + 1} of {questions.length}
      </div>
      {showQuestion && (
        <>
          <h2 className="text-xl font-semibold mb-4 text-gray-800">{questions[currentIndex]}</h2>
          <textarea
            className="w-full border border-gray-300 rounded p-3 mb-4"
            placeholder="Type your answer..."
            rows={4}
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            onClick={handleNext}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded transition"
          >
            Submit Answer
          </button>
        </>
      )}
    </div>
  );
}
