"use client";

import React, { useState, ChangeEvent, FormEvent } from "react";
import InputForm from "@/components/inputForm";
import Messages from "@/components/messages";
import { Message, useChat } from "ai/react";

interface AIPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AIPanel: React.FC<AIPanelProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const { isLoading, stop } = useChat({ api: "api/ai" });

  const addMessage = (newMessage: Message) => {
    setMessages((prevMessages) => [...prevMessages, newMessage]);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const newMessage: Message = {
        id: `${Date.now()}`,
        content: inputMessage,
        role: "user",
    };

    addMessage(newMessage);
    setInputMessage("");

    const isCommandRequest = /^(add account|create account|create new account|add new account|add category|create category|add new category|create new category)/i.test(inputMessage);
    const requestBody = isCommandRequest 
        ? { text: inputMessage }
        : { messages: [...messages, newMessage] };

    const endpoint = isCommandRequest ? "/api/ai/parse" : "/api/ai";

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
        });

        if (response.ok) {
            const data = await response.json();
            console.log("Server Response:", data); // Debugging line
            const assistantMessage: Message = {
                role: "assistant",
                content: isCommandRequest 
                    ? `Processed Command: ${JSON.stringify(data)}` // Adjust based on actual response
                    : data.text,
                id: `${Date.now() + 1}`,
            };

            addMessage(assistantMessage);
        } else {
            const errorData = await response.json();
            console.error("Failed to process message:", errorData.error);
            const errorMessage: Message = {
                role: "assistant",
                content: "Error processing your command. Please try again.",
                id: `${Date.now() + 2}`,
            };
            addMessage(errorMessage);
        }
    } catch (error) {
        console.error("Network error:", error);
        const errorMessage: Message = {
            role: "assistant",
            content: "A network error occurred. Please check your connection and try again.",
            id: `${Date.now() + 3}`,
        };
        addMessage(errorMessage);
    }
};


  if (!isOpen) return null;

  return (
    <div className="fixed bottom-0 right-0 m-4 w-80 bg-white shadow-lg rounded-lg p-4">
      <div className="flex justify-between items-start">
        <div className="text-left font-bold text-lg">Vorifi AI Chatbot</div>
        <button onClick={onClose} className="text-red-500">
          X
        </button>
      </div>
      <div className="overflow-y-auto h-64 mt-2">
        <Messages messages={messages} isLoading={isLoading} />
      </div>
      <InputForm
        input={inputMessage}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
        addMessage={addMessage}
      />
    </div>
  );
};

export default AIPanel;
