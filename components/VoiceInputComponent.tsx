"use client"
import React, { useState, useEffect } from 'react';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

const VoiceInputComponent: React.FC = () => {
  const [userPrompt, setUserPrompt] = useState<string>(''); // For both typed and voice-generated input
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(false); // To toggle between typing and voice mode

  useEffect(() => {
    if (isVoiceMode) {
      setUserPrompt(transcript); // Update user prompt with transcribed text in voice mode
    }
  }, [transcript, isVoiceMode]);

  // Handle listening start and stop
  const handleStartListening = () => {
    resetTranscript();
    SpeechRecognition.startListening({ continuous: true });
  };

  const handleStopListening = () => {
    SpeechRecognition.stopListening();
  };

  const handleSubmit = async () => {
    if (userPrompt.trim() === '') return;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        body: JSON.stringify({ message: userPrompt }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      console.log("AI Response:", data.text);
      alert(`AI Response: ${data.text}`); // Display AI response
    } catch (error) {
      console.error("Error submitting prompt:", error);
    }
  };

  if (!browserSupportsSpeechRecognition) {
    return <span>Browser doesn't support speech recognition.</span>;
  }

  return (
    <div>
      <h1>Submit your prompt</h1>
      <div>
        <label>
          <input
            type="radio"
            checked={!isVoiceMode}
            onChange={() => setIsVoiceMode(false)}
          />
          Type your input
        </label>
        <label>
          <input
            type="radio"
            checked={isVoiceMode}
            onChange={() => setIsVoiceMode(true)}
          />
          Use voice input
        </label>
      </div>

      {!isVoiceMode ? (
        // Text input mode
        <textarea
          value={userPrompt}
          onChange={(e) => setUserPrompt(e.target.value)}
          rows={4}
          cols={50}
          placeholder="Type your prompt here..."
        />
      ) : (
        // Voice input mode
        <div>
          <button onClick={handleStartListening} disabled={listening}>
            {listening ? 'Listening...' : 'Start Voice Input'}
          </button>
          <button onClick={handleStopListening}>Stop Voice Input</button>
          <textarea
            value={userPrompt}
            onChange={(e) => setUserPrompt(e.target.value)} // Allow manual editing of voice-to-text input
            rows={4}
            cols={50}
            placeholder="Your voice input will appear here..."
          />
        </div>
      )}

      <button onClick={handleSubmit} disabled={userPrompt.trim() === ''}>
        Submit to AI
      </button>
    </div>
  );
};

export default VoiceInputComponent;
