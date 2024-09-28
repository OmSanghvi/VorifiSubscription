"use client";


import React, { useState, ChangeEvent, FormEvent } from "react";
import InputForm from "@/components/inputForm";
import Messages from "@/components/messages";
import { Message, useChat } from "ai/react";
import { ChatRequestOptions } from "ai";


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


 const handleSubmit = async (e: FormEvent<HTMLFormElement>, chatRequestOptions?: ChatRequestOptions) => {
   e.preventDefault();


   const newMessage: Message = {
     id: `${Date.now()}`,
     content: inputMessage,
     role: "user",
   };


   addMessage(newMessage);


   setInputMessage("");


   const response = await fetch("/api/ai", {
     method: "POST",
     headers: {
       "Content-Type": "application/json",
     },
     body: JSON.stringify({
       messages: [...messages, newMessage],
     }),
   });


   if (response.ok) {
     const data = await response.json();
     addMessage({
       role: "assistant",
       content: data.text,
       id: `${Date.now()}`,
     });
   } else {
     console.error("Failed to send message:", response.statusText);
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