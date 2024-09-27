"use client"; // Ensure to use client-side rendering if needed
import React, { useState, ChangeEvent, FormEvent } from "react";
import InputForm from "@/components/inputForm"; // Adjust the import based on your structure
import Messages from "@/components/messages"; // Assuming you have a Messages component to render the messages
import { Message, useChat } from "ai/react"; // Adjust import as per your setup
import { ChatRequestOptions } from "ai";

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]); // State to hold messages
  const [inputMessage, setInputMessage] = useState(""); // State to manage the input message
  const { isLoading, stop } = useChat({ api: "api/genai" }); // Your useChat hook

  // Function to handle adding messages
  const addMessage = (newMessage: Message) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputMessage(e.target.value); // Update input state
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>, chatRequestOptions?: ChatRequestOptions) => {
    e.preventDefault();

    // Create the new message
    const newMessage: Message = {
      id: `${Date.now()}`, // Unique ID (consider using a proper UUID if necessary)
      content: inputMessage,
      role: "user", // Assuming the role is "user" for the input
    };

    // Add the new message to state
    addMessage(newMessage);

    // Reset the input field
    setInputMessage("");

    // Send the message to the API
    const response = await fetch("/api/genai", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [...messages, newMessage], // Include previous messages and new message
      }),
    });

    if (response.ok) {
      const data = await response.json();
      // Add AI response message
      addMessage({
        role: "assistant",
        content: data.text,
        id: `${Date.now()}`, // You can manage ID generation better as needed
      });
    } else {
      console.error("Failed to send message:", response.statusText);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 m-4 w-80 bg-white shadow-lg rounded-lg p-4">
      <button onClick={onClose} className="absolute top-2 right-2 text-red-500">
        X
      </button>
      <div className="overflow-y-auto h-64">
        <Messages messages={messages} isLoading={isLoading} /> {/* Render messages */}
      </div>
      <InputForm
        input={inputMessage} // Current input value
        handleInputChange={handleInputChange} // Function to handle input change
        handleSubmit={handleSubmit} // Function to handle form submission
        isLoading={isLoading} // Loading state
        stop={stop} // Stop function if needed
        addMessage={addMessage} // Function to add new message
      />
    </div>
  );
};

export default AIPanel;
