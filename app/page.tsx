'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [jobPost, setJobPost] = useState('');
  const [companyProfile, setCompanyProfile] = useState('');
  const [resume, setResume] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleStartInterview = async (mode: 'text' | 'voice') => {
    if (!jobPost || !companyProfile || !resume) {
      alert('Please fill out all fields.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobPost, companyProfile, resume }),
      });

      const data = await response.json();
      sessionStorage.setItem('questions', JSON.stringify(data.questions));

      router.push(mode === 'voice' ? '/interview/voice' : '/interview/text');
    } catch (error) {
      alert('Failed to start interview.');
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 relative">
      <div className="w-full max-w-2xl bg-white shadow-md rounded-lg p-6 z-10">
        <h1 className="text-2xl font-bold mb-4 text-center text-gray-800">RoboB Interview Agent</h1>

        <textarea
          placeholder="Paste Job Post Here..."
          className="w-full border rounded-md p-3 mb-4 text-sm"
          rows={4}
          value={jobPost}
          onChange={(e) => setJobPost(e.target.value)}
        />

        <textarea
          placeholder="Paste Company Profile Here..."
          className="w-full border rounded-md p-3 mb-4 text-sm"
          rows={3}
          value={companyProfile}
          onChange={(e) => setCompanyProfile(e.target.value)}
        />

        <textarea
          placeholder="Paste Resume Here..."
          className="w-full border rounded-md p-3 mb-4 text-sm"
          rows={4}
          value={resume}
          onChange={(e) => setResume(e.target.value)}
        />

        <button
          onClick={() => handleStartInterview('text')}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md transition"
        >
          Start Text Interview
        </button>

        <button
          onClick={() => handleStartInterview('voice')}
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 mt-4 rounded-md transition"
        >
          Start Voice Interview
        </button>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-gray-500 text-sm mb-3">Or use for live interviews</p>
          <button
            onClick={() => router.push('/coach')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded-md transition"
          >
            🎯 Real-Time Interview Coach
          </button>
          <p className="text-center text-gray-400 text-xs mt-2">
            Get instant answers during Teams/Zoom calls
          </p>
        </div>
      </div>

      {isLoading && (
        <div className="absolute inset-0 bg-black bg-opacity-90 flex flex-col justify-center items-center z-50 text-white">
          <div className="text-2xl sm:text-4xl font-bold mb-6 animate-pulse"> Preparing your interview...</div>
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-blue-500 opacity-70 animate-ping"></div>
            <div className="absolute inset-2 rounded-full bg-blue-600"></div>
          </div>
        </div>
      )}
    </main>
  );
}
