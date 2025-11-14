"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { Home } from 'lucide-react'

interface Message {
  text: string
  sender: "ai" | "user"
  time: string
}

interface Chat {
  messages: Message[]
  lastUpdated: string
  title: string
}

export default function NikoAI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [useMemory, setUseMemory] = useState(true)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<{ [key: string]: Chat }>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const CURRENT_NAMESPACE = useRef<string>("")

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/b7e1d215-fd19-4404-88ce-b6a8d13db9ad/chat?action=sendMessage"

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }

    let ns = localStorage.getItem("Namespace")
    if (!ns) {
      ns = generateUUID()
      localStorage.setItem("Namespace", ns)
    }
    CURRENT_NAMESPACE.current = ns

    const savedSidebarVisible = localStorage.getItem("niko-ai-sidebar-visible")
    if (savedSidebarVisible !== null) {
      setSidebarVisible(savedSidebarVisible !== "false")
    }

    const savedUseMemory = localStorage.getItem("niko-ai-use-memory")
    if (savedUseMemory !== null) {
      setUseMemory(savedUseMemory !== "false")
    }

    const parsedChats = JSON.parse(localStorage.getItem("niko-ai-chats") || "{}")
    setChats(parsedChats)

    if (Object.keys(parsedChats).length > 0) {
      const sortedChats = (Object.entries(parsedChats) as [string, Chat][]).sort(
        ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
      )
      const mostRecentChatId = sortedChats[0][0]
      setCurrentChatId(mostRecentChatId)
      setMessages(parsedChats[mostRecentChatId].messages || [])
    } else {
      createInitialMessage()
    }
  }, [])

  const createInitialMessage = () => {
    const initialMessage: Message = {
      text: "Ciao, sono Niko AI. Il tuo SEO Strategist virtuale, progettato per sviluppare una strategia SEO a lungo termine e migliorare la tua presenza online. Come posso supportarti oggi?",
      sender: "ai",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages([initialMessage])
  }

  const formatMessageText = (text: string) => {
    let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>")
    formatted = formatted.replace(
      /`([^`]+?)`/g,
      '<code style="background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>',
    )
    formatted = formatted.replace(
      /\[([^\]]+?)\]$$(https?:\/\/[^\s)]+)$$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #235E84; text-decoration: underline;">$1</a>',
    )
    formatted = formatted.replace(/\n/g, "<br>")

    return formatted
  }

  const saveChat = (newTitle: string | null = null) => {
    if (messages.length === 0) return

    let title = newTitle || chats[currentChatId]?.title || "Nuova Conversazione"
    if (!newTitle) {
      const firstUserMessage = messages.find((m) => m.sender === "user")
      if (firstUserMessage) {
        title = firstUserMessage.text.slice(0, 40)
      }
    }

    const updatedChats = {
      ...chats,
      [currentChatId]: {
        messages,
        lastUpdated: new Date().toISOString(),
        title,
      },
    }

    setChats(updatedChats)
    localStorage.setItem("niko-ai-chats", JSON.stringify(updatedChats))
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      text: inputValue,
      sender: "user",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    const thinkingMessage: Message = {
      text: "",
      sender: "ai",
      time: "",
    }
    setMessages((prev) => [...prev, thinkingMessage])

    try {
      const sessionId = localStorage.getItem("niko-ai-session-id") || `session_${Date.now()}`
      localStorage.setItem("niko-ai-session-id", sessionId)

      const response = await fetch(N8N_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          chatInput: inputValue,
          sessionId: sessionId,
          useMemory: useMemory,
          metadata: {
            namespace: CURRENT_NAMESPACE.current,
            source: "niko-ai-chat",
          },
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const reader = response.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let accumulatedText = ""
      let streamMode: "sse" | "jsonl" | null = null
      let isFirstChunk = true
      let generatedTitle: string | null = null

      const handleEvent = (jsonStr: string) => {
        try {
          const obj = JSON.parse(jsonStr)
          if (obj.type === "item" && typeof obj.content === "string") {
            if (isFirstChunk) {
              isFirstChunk = false
            }
            accumulatedText += obj.content
            setMessages((prev) => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1] = {
                text: accumulatedText,
                sender: "ai",
                time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
              }
              return newMessages
            })
          } else if (obj.type === "end" && obj.title) {
            generatedTitle = obj.title
          }
        } catch (e) {
          // Ignore parse errors
        }
      }

      if (reader) {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          if (!streamMode) {
            const probe = buffer.trimStart()
            if (probe.startsWith("data:")) {
              streamMode = "sse"
            } else if (probe.startsWith("{") || probe.startsWith("[")) {
              streamMode = "jsonl"
            } else {
              streamMode = "jsonl"
            }
          }

          if (streamMode === "sse") {
            let idx
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
              const eventBlock = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 2)
              const dataLines = eventBlock.split("\n").filter((l) => l.startsWith("data:"))
              if (dataLines.length > 0) {
                const jsonStr = dataLines
                  .map((l) => l.replace(/^data:\s?/, ""))
                  .join("\n")
                  .trim()
                if (jsonStr) handleEvent(jsonStr)
              }
            }
          } else {
            const lines = buffer.split(/\r?\n/)
            buffer = lines.pop() || ""
            for (const line of lines) {
              const trimmed = line.trim()
              if (trimmed) handleEvent(trimmed)
            }
          }
        }

        const leftover = buffer.trim()
        if (leftover) {
          if (streamMode === "sse") {
            const dataLines = leftover.split("\n").filter((l) => l.startsWith("data:"))
            if (dataLines.length > 0) {
              const jsonStr = dataLines
                .map((l) => l.replace(/^data:\s?/, ""))
                .join("\n")
                .trim()
              if (jsonStr) handleEvent(jsonStr)
            }
          } else {
            handleEvent(leftover)
          }
        }
      }

      if (!accumulatedText) {
        setMessages((prev) => {
          const newMessages = [...prev]
          newMessages[newMessages.length - 1] = {
            text: "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore.",
            sender: "ai",
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
          }
          return newMessages
        })
      }

      setTimeout(() => saveChat(generatedTitle), 100)
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          text: "Errore di connessione. Riprova più tardi.",
          sender: "ai",
          time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        }
        return newMessages
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createNewChat = () => {
    const newChatId = `chat_${Date.now()}`
    setCurrentChatId(newChatId)
    localStorage.setItem("niko-ai-session-id", newChatId)
    createInitialMessage()
  }

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId)
    const chat = chats[chatId]
    setMessages(chat.messages || [])
  }

  const deleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!confirm("Sei sicuro di voler eliminare questa conversazione?")) return

    const updatedChats = { ...chats }
    delete updatedChats[chatId]
    setChats(updatedChats)
    localStorage.setItem("niko-ai-chats", JSON.stringify(updatedChats))

    if (chatId === currentChatId) {
      const remainingChats = Object.keys(updatedChats)
      if (remainingChats.length > 0) {
        loadChat(remainingChats[0])
      } else {
        createNewChat()
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]

  const sortedChats = (Object.entries(chats) as [string, Chat][])
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 50)

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&family=Open+Sans:wght@400;500;600&display=swap');

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .niko-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          overflow: hidden;
          background: #ffffff;
        }

        .niko-sidebar {
          width: 320px;
          min-width: 320px;
          background: #ffffff;
          border-right: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .niko-sidebar.hidden {
          width: 0;
          min-width: 0;
          overflow: hidden;
          border-right: none;
        }

        .niko-sidebar-header {
          padding: 20px;
          border-bottom: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .niko-brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .niko-brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .niko-profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          background: #235E84;
        }

        .niko-profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .niko-brand-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: #475569;
        }

        .niko-new-chat-btn {
          background: #235E84;
          border: none;
          color: #ffffff;
          padding: 14px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s ease;
          width: 100%;
        }

        .niko-new-chat-btn:hover {
          background: #1e4f6f;
          transform: translateY(-1px);
        }

        .niko-memory-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 0 0;
          font-size: 14px;
          font-weight: 500;
          color: #475569;
        }

        .niko-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .niko-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .niko-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.4s;
          border-radius: 24px;
        }

        .niko-slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.4s;
          border-radius: 50%;
        }

        .niko-switch input:checked + .niko-slider {
          background-color: #235E84;
        }

        .niko-switch input:checked + .niko-slider:before {
          transform: translateX(20px);
        }

        .niko-sidebar-split {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .niko-chat-list-wrapper {
          flex: 1 1 auto;
          overflow-y: auto;
          padding: 16px 20px;
          min-height: 100px;
        }

        .niko-chat-item {
          padding: 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 2px;
          background: transparent;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .niko-chat-item:hover {
          background: #E3F2FD;
        }

        .niko-chat-item.active {
          background: #E3F2FD;
          color: #235E84;
        }

        .niko-chat-item-content {
          flex: 1;
        }

        .niko-chat-item-title {
          font-weight: 500;
          font-size: 14px;
          color: #475569;
          margin-bottom: 4px;
        }

        .niko-chat-item-subtitle {
          font-size: 12px;
          color: #64748b;
        }

        .niko-delete-btn {
          opacity: 0;
          background: #ef4444;
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          font-size: 12px;
        }

        .niko-chat-item:hover .niko-delete-btn {
          opacity: 1;
        }

        .niko-delete-btn:hover {
          background: #dc2626;
        }

        .niko-agents-section {
          flex: 1 1 auto;
          min-height: 150px;
          margin-top: 0;
          padding: 16px 20px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          flex-direction: column;
        }

        .niko-agents-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: #475569;
          margin-bottom: 16px;
          flex-shrink: 0;
        }

        .niko-agents-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .niko-agent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: #475569;
          transition: background-color 0.2s ease;
        }

        .niko-agent-item:hover {
          background-color: #E3F2FD;
        }

        .niko-agent-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #f8fafc;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .niko-agent-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .niko-agent-name {
          font-size: 14px;
          font-weight: 500;
        }

        .niko-chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: #ffffff;
        }

        .niko-chat-header {
          background: #235E84;
          color: #ffffff;
          padding: 20px 40px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 80px;
        }

        .niko-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .niko-header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .niko-home-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          color: #ffffff;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
          text-decoration: none;
        }

        .niko-home-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .niko-toggle-btn {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          color: #ffffff;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .niko-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .niko-chat-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
        }

        .niko-messages {
          flex: 1;
          overflow-y: auto;
          padding: 50px 80px;
          background: #ffffff;
        }

        .niko-message {
          margin-bottom: 32px;
          display: flex;
          align-items: flex-start;
          gap: 20px;
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          max-width: 90%;
        }

        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .niko-message.user {
          flex-direction: row-reverse;
          margin-left: auto;
        }

        .niko-message-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          flex-shrink: 0;
          overflow: hidden;
        }

        .niko-message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .niko-message.ai .niko-message-avatar {
          background: linear-gradient(135deg, #235E84 0%, #235E84 100%);
          color: #ffffff;
        }

        .niko-message.user .niko-message-avatar {
          background: #E3F2FD;
          color: #235E84;
        }

        .niko-message-content {
          flex: 1;
          background: #ffffff;
          padding: 20px 24px;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          min-width: 200px;
        }

        .niko-message.user .niko-message-content {
          background: #235E84;
          color: #ffffff;
          border-color: #235E84;
        }

        .niko-message-text {
          color: #334155;
          line-height: 1.6;
          font-size: 15px;
        }

        .niko-message.user .niko-message-text {
          color: #ffffff;
        }

        .niko-message-time {
          font-size: 12px;
          color: #64748b;
          margin-top: 8px;
        }

        .niko-message.user .niko-message-time {
          color: rgba(255, 255, 255, 0.7);
        }

        .niko-thinking-dots {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .niko-thinking-dots .dot {
          width: 8px;
          height: 8px;
          background-color: #64748b;
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }

        .niko-thinking-dots .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .niko-thinking-dots .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%, 60%, 100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        .niko-input-container {
          padding: 30px 80px;
          border-top: 1px solid #e2e8f0;
          background: #ffffff;
        }

        .niko-input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          background: #ffffff;
          border: 2px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 16px;
          transition: all 0.2s ease;
        }

        .niko-input-wrapper:focus-within {
          border-color: #235E84;
          box-shadow: 0 0 0 3px rgba(35, 94, 132, 0.1);
        }

        .niko-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 15px;
          color: #475569;
          resize: none;
          min-height: 24px;
          max-height: 120px;
          font-family: 'Open Sans', sans-serif;
        }

        .niko-input::placeholder {
          color: #64748b;
        }

        .niko-send-btn {
          background: #235E84;
          border: none;
          color: #ffffff;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .niko-send-btn:hover:not(:disabled) {
          background: #1e4f6f;
          transform: scale(1.05);
        }

        .niko-send-btn:disabled {
          background: #f8fafc;
          color: #64748b;
          cursor: not-allowed;
        }

        .niko-mobile-menu-btn {
          display: none;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          color: #ffffff;
          transition: all 0.2s ease;
          align-items: center;
          justify-content: center;
        }

        .niko-mobile-menu-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .niko-sidebar-close-btn {
          display: none;
          background: transparent;
          border: none;
          color: #64748b;
          padding: 8px;
          cursor: pointer;
          font-size: 24px;
          line-height: 1;
          transition: color 0.2s ease;
        }

        .niko-sidebar-close-btn:hover {
          color: #235E84;
        }

        @media (max-width: 1024px) {
          .niko-sidebar {
            width: 280px;
            min-width: 280px;
          }

          .niko-chat-header {
            padding: 16px 24px;
          }

          .niko-messages {
            padding: 24px 32px;
          }

          .niko-input-container {
            padding: 20px 24px;
          }

          .niko-message {
            max-width: 92%;
          }
        }

        @media (max-width: 768px) {
          .niko-mobile-menu-btn {
            display: flex;
          }

          .niko-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 300px;
            min-width: 300px;
            z-index: 1000;
            transform: translateX(-100%);
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
          }

          .niko-sidebar.mobile-open {
            transform: translateX(0);
          }

          .niko-sidebar.hidden {
            transform: translateX(-100%);
          }

          .niko-sidebar-close-btn {
            display: block;
          }

          .niko-toggle-btn {
            display: none;
          }

          .niko-chat-header {
            padding: 12px 16px;
            min-height: 60px;
          }

          .niko-chat-title {
            font-size: 16px;
          }

          .niko-messages {
            padding: 16px;
          }

          .niko-input-container {
            padding: 12px 16px;
          }

          .niko-message {
            max-width: 100%;
            gap: 12px;
            margin-bottom: 20px;
          }

          .niko-message-avatar {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }

          .niko-message-content {
            padding: 14px 16px;
          }

          .niko-message-text {
            font-size: 14px;
          }

          .niko-home-btn,
          .niko-mobile-menu-btn {
            padding: 8px;
          }
        }

        @media (max-width: 480px) {
          .niko-sidebar {
            width: 280px;
            min-width: 280px;
          }

          .niko-sidebar-header {
            padding: 16px;
          }

          .niko-brand-title {
            font-size: 18px;
          }

          .niko-profile-avatar {
            width: 36px;
            height: 36px;
          }

          .niko-new-chat-btn {
            padding: 12px 16px;
            font-size: 13px;
          }

          .niko-chat-header {
            padding: 10px 12px;
          }

          .niko-chat-title {
            font-size: 14px;
          }

          .niko-messages {
            padding: 12px;
          }

          .niko-message {
            gap: 10px;
            margin-bottom: 16px;
          }

          .niko-message-avatar {
            width: 28px;
            height: 28px;
          }

          .niko-message-content {
            padding: 12px 14px;
          }

          .niko-message-text {
            font-size: 13px;
          }

          .niko-input-container {
            padding: 10px 12px;
          }

          .niko-input-wrapper {
            padding: 10px 12px;
          }

          .niko-input {
            font-size: 14px;
          }

          .niko-send-btn {
            width: 36px;
            height: 36px;
          }
        }

        @media (max-width: 360px) {
          .niko-sidebar {
            width: 260px;
            min-width: 260px;
          }

          .niko-chat-title {
            font-size: 13px;
          }

          .niko-message-text {
            font-size: 12px;
          }
        }

        @media (max-width: 768px) {
          .niko-messages::-webkit-scrollbar,
          .niko-chat-list-wrapper::-webkit-scrollbar,
          .niko-agents-list::-webkit-scrollbar {
            width: 4px;
          }
        }
      `}</style>

      <div className="niko-container">
        <div className={`niko-sidebar ${!sidebarVisible ? "hidden" : ""} ${isMobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="niko-sidebar-header">
            <div className="niko-brand-header">
              <div className="niko-brand-section">
                <div className="niko-profile-avatar">
                  <img src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png" alt="Niko AI" />
                </div>
                <div className="niko-brand-title">Niko AI</div>
              </div>
              <button
                className="niko-sidebar-close-btn"
                onClick={() => {
                  setIsMobileMenuOpen(false)
                }}
                title="Chiudi menu"
              >
                ×
              </button>
            </div>
            <button className="niko-new-chat-btn" onClick={createNewChat}>
              <span>+</span> Nuova Chat
            </button>
            <div className="niko-memory-toggle">
              <label htmlFor="memoryToggle">Usa Memoria</label>
              <label className="niko-switch">
                <input
                  type="checkbox"
                  id="memoryToggle"
                  checked={useMemory}
                  onChange={(e) => {
                    setUseMemory(e.target.checked)
                    localStorage.setItem("niko-ai-use-memory", String(e.target.checked))
                  }}
                />
                <span className="niko-slider"></span>
              </label>
            </div>
          </div>

          <div className="niko-sidebar-split">
            <div className="niko-chat-list-wrapper">
              {sortedChats.map(([id, chat]) => {
                const dateObj = new Date(chat.lastUpdated)
                const dayNum = dateObj.getDate()
                const monthStr = monthNames[dateObj.getMonth()]
                const hourStr = String(dateObj.getHours()).padStart(2, "0")
                const minuteStr = String(dateObj.getMinutes()).padStart(2, "0")
                const formattedDate = `${dayNum} ${monthStr} h. ${hourStr}:${minuteStr}`

                return (
                  <div
                    key={id}
                    className={`niko-chat-item ${id === currentChatId ? "active" : ""}`}
                    onClick={() => loadChat(id)}
                  >
                    <div className="niko-chat-item-content">
                      <div className="niko-chat-item-title">{chat.title || "Nuova Conversazione"}</div>
                      <div className="niko-chat-item-subtitle">{formattedDate}</div>
                    </div>
                    <button
                      className="niko-delete-btn"
                      onClick={(e) => deleteChat(id, e)}
                      title="Elimina conversazione"
                    >
                      🗑
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="niko-agents-section">
              <h3 className="niko-agents-title">AGENTI AI:</h3>
              <div className="niko-agents-list">
                <Link href="/tony-ai" className="niko-agent-item">
                  <div className="niko-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png"
                      alt="Tony"
                    />
                  </div>
                  <span className="niko-agent-name">Tony AI</span>
                </Link>
                <Link href="/aladino-ai" className="niko-agent-item">
                  <div className="niko-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                      alt="Aladino"
                    />
                  </div>
                  <span className="niko-agent-name">Aladdin AI</span>
                </Link>
                <Link href="/lara-ai" className="niko-agent-item">
                  <div className="niko-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                      alt="Lara"
                    />
                  </div>
                  <span className="niko-agent-name">Lara AI</span>
                </Link>
                <Link href="/simone-ai" className="niko-agent-item">
                  <div className="niko-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png"
                      alt="Simone"
                    />
                  </div>
                  <span className="niko-agent-name">Simone AI</span>
                </Link>
                <Link href="/" className="niko-agent-item">
                  <div className="niko-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                      alt="Mike"
                    />
                  </div>
                  <span className="niko-agent-name">Mike AI</span>
                </Link>
                <Link href="/alex-ai" className="niko-agent-item">
                  <div className="niko-agent-avatar">
                    <img
                      src="https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                      alt="Alex"
                    />
                  </div>
                  <span className="niko-agent-name">Alex AI</span>
                </Link>
                <Link href="/daniele-ai" className="niko-agent-item">
                  <div className="niko-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                      alt="Daniele"
                    />
                  </div>
                  <span className="niko-agent-name">Daniele AI</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="niko-chat-container">
          <div className="niko-chat-header">
            <div className="niko-header-left">
              <button
                className="niko-mobile-menu-btn"
                onClick={() => setIsMobileMenuOpen(true)}
                title="Mostra menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <button
                className="niko-toggle-btn"
                onClick={() => {
                  setSidebarVisible(!sidebarVisible)
                  localStorage.setItem("niko-ai-sidebar-visible", String(!sidebarVisible))
                }}
                title="Mostra/Nascondi conversazioni"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  {sidebarVisible ? (
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  ) : (
                    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                  )}
                </svg>
              </button>
              <div className="niko-chat-title">Niko AI - SEO Manager</div>
            </div>
            <div className="niko-header-right">
              <Link href="/" className="niko-home-btn" title="Home">
                <Home size={20} />
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "w-10 h-10",
                  },
                }}
              />
            </div>
          </div>

          <div className="niko-messages">
            {messages.map((message, index) => (
              <div key={index} className={`niko-message ${message.sender}`}>
                <div className="niko-message-avatar">
                  {message.sender === "ai" ? (
                    <img src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png" alt="Niko AI" />
                  ) : (
                    <img
                      src="https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                      alt="User"
                    />
                  )}
                </div>
                <div className="niko-message-content">
                  <div className="niko-message-text">
                    {message.text === "" && message.time === "" ? (
                      <div className="niko-thinking-dots">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: formatMessageText(message.text) }} />
                    )}
                  </div>
                  {message.time && <div className="niko-message-time">{message.time}</div>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="niko-input-container">
            <div className="niko-input-wrapper">
              <textarea
                ref={textareaRef}
                className="niko-input"
                placeholder="Scrivi la tua domanda per Niko..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
              />
              <button
                className="niko-send-btn"
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                title="Invia (Invio)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
