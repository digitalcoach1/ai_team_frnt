"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
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

export default function LaraAI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<{ [key: string]: Chat }>({})
  const [useMemory, setUseMemory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const CURRENT_NAMESPACE = useRef<string>("")

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/59483f3b-8c59-4381-b94b-9c80a69b8196/chat?action=sendMessage"

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

    const savedChats = localStorage.getItem("lara-ai-chats")
    const parsedChats = savedChats ? JSON.parse(savedChats) : {}
    setChats(parsedChats)

    const savedSidebarVisible = localStorage.getItem("lara-ai-sidebar-visible")
    if (savedSidebarVisible !== null) {
      setSidebarVisible(savedSidebarVisible !== "false")
    }

    const savedUseMemory = localStorage.getItem("lara-ai-use-memory")
    if (savedUseMemory !== null) {
      setUseMemory(savedUseMemory !== "false")
    }

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    localStorage.setItem("lara-ai-sidebar-visible", String(sidebarVisible))
  }, [sidebarVisible])

  useEffect(() => {
    localStorage.setItem("lara-ai-use-memory", String(useMemory))
  }, [useMemory])

  const createInitialMessage = () => {
    setMessages([
      {
        text: "Ciao, sono Lara AI, un Social Media Manager virtuale, perfetta per gestire e automatizzare la creazione dei tuoi contenuti sui social media. Come posso supportarti oggi?",
        sender: "ai",
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      },
    ])
  }

  const saveChat = (newTitle?: string) => {
    if (messages.length === 0) return

    let title = newTitle || chats[currentChatId]?.title || "Nuova Conversazione"
    if (!newTitle) {
      const firstUser = messages.find((m) => m.sender === "user")
      if (firstUser) {
        title = firstUser.text.slice(0, 40)
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
    localStorage.setItem("lara-ai-chats", JSON.stringify(updatedChats))
  }

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId)
    const chat = chats[chatId]
    if (chat) {
      setMessages(chat.messages || [])
    }
  }

  const deleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!confirm("Sei sicuro di voler eliminare questa conversazione?")) return

    const updatedChats = { ...chats }
    delete updatedChats[chatId]
    setChats(updatedChats)
    localStorage.setItem("lara-ai-chats", JSON.stringify(updatedChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(updatedChats)
      if (remaining.length > 0) {
        loadChat(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    localStorage.setItem("lara-ai-session-id", newChatId)
    createInitialMessage()
  }

  const formatMessageText = (text: string): string => {
    let t = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>")
    t = t.replace(
      /`([^`]+?)`/g,
      '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:0.9em;">$1</code>',
    )
    t = t.replace(
      /\[([^\]]+?)\]\$\$(https?:\/\/[^\s)]+)\$\$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color:#235E84;text-decoration:underline;">$1</a>',
    )
    t = t.replace(/\n/g, "<br>")
    return t
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      text: inputValue.trim(),
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
      const sessionId = localStorage.getItem("lara-ai-session-id") || `session_${Date.now()}`
      localStorage.setItem("lara-ai-session-id", sessionId)

      const response = await fetch(N8N_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          chatInput: userMessage.text,
          sessionId: sessionId,
          useMemory: useMemory,
          metadata: { namespace: CURRENT_NAMESPACE.current, source: "lara-ai-chat" },
        }),
      })

      if (!response.ok) throw new Error(`HTTP error ${response.status}`)

      const reader = response.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let accumulatedText = ""
      let streamMode: "sse" | "jsonl" | null = null
      let generatedTitle: string | null = null

      const handleEvent = (jsonStr: string) => {
        try {
          const obj = JSON.parse(jsonStr)
          if (obj.type === "item" && typeof obj.content === "string") {
            accumulatedText += obj.content
            setMessages((prev) => {
              const updated = [...prev]
              const lastMsg = updated[updated.length - 1]
              if (lastMsg && lastMsg.sender === "ai") {
                lastMsg.text = accumulatedText
                lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
              }
              return updated
            })
          } else if (obj.type === "end" && obj.title) {
            generatedTitle = obj.title
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      if (reader) {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          if (!streamMode) {
            const probe = buffer.trimStart()
            if (probe.startsWith("data:")) streamMode = "sse"
            else if (probe.startsWith("{") || probe.startsWith("[")) streamMode = "jsonl"
            else streamMode = "jsonl"
          }

          if (streamMode === "sse") {
            let idx
            while ((idx = buffer.indexOf("\n\n")) !== -1) {
              const eventBlock = buffer.slice(0, idx)
              buffer = buffer.slice(idx + 2)
              const dataLines = eventBlock.split("\n").filter((l) => l.startsWith("data:"))
              if (!dataLines.length) continue
              const jsonStr = dataLines
                .map((l) => l.replace(/^data:\s?/, ""))
                .join("\n")
                .trim()
              if (jsonStr) handleEvent(jsonStr)
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
            if (dataLines.length) {
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

      setMessages((prev) => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.sender === "ai") {
          if (!lastMsg.text) {
            lastMsg.text = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
          }
          lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        }
        return updated
      })

      setTimeout(() => saveChat(generatedTitle || undefined), 100)
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.sender === "ai") {
          lastMsg.text = "Errore di connessione. Riprova più tardi."
          lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const sortedChats = (Object.entries(chats) as [string, Chat][])
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 50)

  const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]

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
          overflow: hidden;
        }

        :root {
          --background: #ffffff;
          --foreground: #475569;
          --card: #ffffff;
          --card-foreground: #334155;
          --primary: #235E84;
          --primary-foreground: #ffffff;
          --secondary: #E3F2FD;
          --secondary-foreground: #235E84;
          --muted: #f8fafc;
          --muted-foreground: #64748b;
          --accent: #235E84;
          --sidebar: #ffffff;
          --sidebar-foreground: #475569;
          --sidebar-primary: #E3F2FD;
          --sidebar-border: #e2e8f0;
          --border: #e2e8f0;
          --radius: 12px;
        }

        .app-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          overflow: hidden;
          background: var(--background);
        }

        .sidebar {
          width: 320px;
          min-width: 320px;
          background: var(--sidebar);
          border-right: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .sidebar.hidden {
          width: 0;
          min-width: 0;
          overflow: hidden;
          border-right: none;
        }

        /* Added mobile responsive styles for sidebar */
        @media (max-width: 768px) {
          .sidebar {
            position: fixed;
            left: 0;
            top: 0;
            bottom: 0;
            width: 280px;
            min-width: 280px;
            z-index: 1000;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
          }

          .sidebar.hidden {
            transform: translateX(-100%);
          }

          .sidebar:not(.hidden)::before {
            content: '';
            position: fixed;
            top: 0;
            left: 280px;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: -1;
          }
        }

        @media (max-width: 480px) {
          .sidebar {
            width: 260px;
            min-width: 260px;
          }

          .sidebar:not(.hidden)::before {
            left: 260px;
          }
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid var(--sidebar-border);
        }

        /* Added responsive padding for sidebar header */
        @media (max-width: 768px) {
          .sidebar-header {
            padding: 16px;
          }
        }

        @media (max-width: 480px) {
          .sidebar-header {
            padding: 12px;
          }
        }

        .brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        /* Added responsive spacing for brand header */
        @media (max-width: 768px) {
          .brand-header {
            margin-bottom: 16px;
          }
        }

        /* Added mobile close button styles */
        .mobile-close-btn {
          display: none;
          background: transparent;
          border: none;
          color: var(--sidebar-foreground);
          cursor: pointer;
          padding: 4px;
          font-size: 24px;
          line-height: 1;
          transition: color 0.2s ease;
        }

        .mobile-close-btn:hover {
          color: var(--primary);
        }

        @media (max-width: 768px) {
          .mobile-close-btn {
            display: block;
          }
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: var(--primary);
        }

        /* Added responsive avatar size */
        @media (max-width: 480px) {
          .profile-avatar {
            width: 32px;
            height: 32px;
          }
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .brand-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--sidebar-foreground);
        }

        /* Added responsive font size for brand title */
        @media (max-width: 768px) {
          .brand-title {
            font-size: 18px;
          }
        }

        @media (max-width: 480px) {
          .brand-title {
            font-size: 16px;
          }
        }

        .new-chat-button {
          background: var(--primary);
          border: none;
          color: var(--primary-foreground);
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

        /* Added responsive padding for new chat button */
        @media (max-width: 768px) {
          .new-chat-button {
            padding: 12px 16px;
            font-size: 13px;
          }
        }

        .new-chat-button:hover {
          background: var(--accent);
          transform: translateY(-1px);
        }

        .memory-toggle-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 0 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--sidebar-foreground);
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
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

        .slider:before {
          position: absolute;
          content: '';
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: 0.4s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: var(--primary);
        }

        input:checked + .slider:before {
          transform: translateX(20px);
        }

        .sidebar-split-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .chat-list-wrapper {
          flex: 1 1 auto;
          max-height: 40%;
          overflow-y: auto;
          padding: 16px 20px;
          min-height: 100px;
        }

        .chat-list-wrapper::-webkit-scrollbar {
          width: 6px;
        }

        .chat-list-wrapper::-webkit-scrollbar-track {
          background: transparent;
        }

        .chat-list-wrapper::-webkit-scrollbar-thumb {
          background: var(--sidebar-border);
          border-radius: 3px;
        }

        .chat-list-wrapper::-webkit-scrollbar-thumb:hover {
          background: var(--muted-foreground);
        }

        .chat-item {
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

        .chat-item:hover {
          background: var(--sidebar-primary);
        }

        .chat-item.active {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }

        .chat-item-content {
          flex: 1;
        }

        .chat-item-title {
          font-weight: 500;
          font-size: 14px;
          color: var(--sidebar-foreground);
          margin-bottom: 4px;
        }

        .chat-item-subtitle {
          font-size: 12px;
          color: var(--muted-foreground);
        }

        .delete-chat-btn {
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

        .chat-item:hover .delete-chat-btn {
          opacity: 1;
        }

        .delete-chat-btn:hover {
          background: #dc2626;
        }

        .agents-section {
          flex: 1 1 auto;
          min-height: 150px;
          margin-top: 0;
          padding: 16px 20px;
          border-top: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .agents-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: var(--sidebar-foreground);
          margin-bottom: 16px;
          padding: 0 4px;
          flex-shrink: 0;
        }

        .agents-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          min-height: 0;
        }

        .agents-list::-webkit-scrollbar {
          width: 6px;
        }

        .agents-list::-webkit-scrollbar-track {
          background: transparent;
        }

        .agents-list::-webkit-scrollbar-thumb {
          background: var(--sidebar-border);
          border-radius: 3px;
        }

        .agents-list::-webkit-scrollbar-thumb:hover {
          background: var(--muted-foreground);
        }

        .agent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--sidebar-foreground);
          transition: background-color 0.2s ease;
        }

        .agent-item:hover {
          background-color: var(--sidebar-primary);
        }

        .agent-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
        }

        .agent-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .agent-name {
          font-size: 14px;
          font-weight: 500;
        }

        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--background);
        }

        .chat-header {
          background: #235E84;
          color: #ffffff;
          padding: 20px 40px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 80px;
        }

        /* Added responsive padding and height for chat header */
        @media (max-width: 1024px) {
          .chat-header {
            padding: 16px 24px;
            min-height: 70px;
          }
        }

        @media (max-width: 768px) {
          .chat-header {
            padding: 12px 16px;
            min-height: 60px;
          }
        }

        @media (max-width: 480px) {
          .chat-header {
            padding: 10px 12px;
            min-height: 56px;
          }
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Added responsive gap for header left */
        @media (max-width: 768px) {
          .header-left {
            gap: 12px;
          }
        }

        @media (max-width: 480px) {
          .header-left {
            gap: 8px;
          }
        }

        .header-right {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Added responsive gap for header right */
        @media (max-width: 768px) {
          .header-right {
            gap: 12px;
          }
        }

        @media (max-width: 480px) {
          .header-right {
            gap: 8px;
          }
        }

        .home-button {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #ffffff;
          transition: all 0.2s ease;
          cursor: pointer;
        }

        /* Added responsive size for home button */
        @media (max-width: 768px) {
          .home-button {
            width: 36px;
            height: 36px;
          }
        }

        @media (max-width: 480px) {
          .home-button {
            width: 32px;
            height: 32px;
          }
        }

        .home-button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .chat-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
        }

        /* Added responsive font size for chat title */
        @media (max-width: 1024px) {
          .chat-title {
            font-size: 18px;
          }
        }

        @media (max-width: 768px) {
          .chat-title {
            font-size: 16px;
          }
        }

        @media (max-width: 480px) {
          .chat-title {
            font-size: 14px;
          }
        }

        /* Added mobile hamburger menu button styles */
        .toggle-sidebar-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #ffffff;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .toggle-sidebar-btn:hover {
          background: rgba(255, 255, 255, 0.1);
        }

        @media (max-width: 768px) {
          .toggle-sidebar-btn {
            width: 36px;
            height: 36px;
          }

          .toggle-sidebar-btn svg {
            display: none;
          }

          .toggle-sidebar-btn::before {
            content: '☰';
            font-size: 20px;
          }
        }

        @media (max-width: 480px) {
          .toggle-sidebar-btn {
            width: 32px;
            height: 32px;
          }

          .toggle-sidebar-btn::before {
            font-size: 18px;
          }
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 50px 80px;
          background: var(--background);
        }

        /* Added responsive padding for chat messages */
        @media (max-width: 1024px) {
          .chat-messages {
            padding: 40px 40px;
          }
        }

        @media (max-width: 768px) {
          .chat-messages {
            padding: 24px 20px;
          }
        }

        @media (max-width: 480px) {
          .chat-messages {
            padding: 16px 12px;
          }
        }

        .message {
          margin-bottom: 32px;
          display: flex;
          align-items: flex-start;
          gap: 20px;
          animation: fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1);
          max-width: 90%;
        }

        /* Added responsive spacing and width for messages */
        @media (max-width: 768px) {
          .message {
            margin-bottom: 24px;
            gap: 12px;
            max-width: 95%;
          }
        }

        @media (max-width: 480px) {
          .message {
            margin-bottom: 20px;
            gap: 10px;
            max-width: 98%;
          }
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

        .message.user {
          flex-direction: row-reverse;
          margin-left: auto;
        }

        .message-avatar {
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

        /* Added responsive size for message avatar */
        @media (max-width: 768px) {
          .message-avatar {
            width: 36px;
            height: 36px;
            font-size: 13px;
          }
        }

        @media (max-width: 480px) {
          .message-avatar {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }
        }

        .message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .message.ai .message-avatar {
          background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
          color: var(--primary-foreground);
        }

        .message.user .message-avatar {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }

        .message-content {
          flex: 1;
          background: #ffffff;
          padding: 20px 24px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          min-width: 200px;
        }

        /* Added responsive padding for message content */
        @media (max-width: 768px) {
          .message-content {
            padding: 16px 18px;
            min-width: 150px;
          }
        }

        @media (max-width: 480px) {
          .message-content {
            padding: 12px 14px;
            min-width: 100px;
          }
        }

        .message.user .message-content {
          background: #235E84;
          color: #ffffff;
          border-color: #235E84;
        }

        .message-text {
          color: var(--card-foreground);
          line-height: 1.6;
          font-size: 15px;
        }

        /* Added responsive font size for message text */
        @media (max-width: 768px) {
          .message-text {
            font-size: 14px;
            line-height: 1.5;
          }
        }

        @media (max-width: 480px) {
          .message-text {
            font-size: 13px;
            line-height: 1.4;
          }
        }

        .message.user .message-text {
          color: #ffffff;
        }

        .message-time {
          font-size: 12px;
          color: var(--muted-foreground);
          margin-top: 8px;
        }

        .message.user .message-time {
          color: rgba(255, 255, 255, 0.7);
        }

        .thinking-dots {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .thinking-dots .dot {
          width: 8px;
          height: 8px;
          background-color: var(--muted-foreground);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }

        .thinking-dots .dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .thinking-dots .dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes typing {
          0%,
          60%,
          100% {
            transform: translateY(0);
            opacity: 0.4;
          }
          30% {
            transform: translateY(-10px);
            opacity: 1;
          }
        }

        .input-container {
          padding: 30px 80px;
          border-top: 1px solid var(--border);
          background: var(--background);
        }

        /* Added responsive padding for input container */
        @media (max-width: 1024px) {
          .input-container {
            padding: 24px 40px;
          }
        }

        @media (max-width: 768px) {
          .input-container {
            padding: 16px 20px;
          }
        }

        @media (max-width: 480px) {
          .input-container {
            padding: 12px 12px;
          }
        }

        .input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          background: var(--background);
          border: 2px solid var(--border);
          border-radius: var(--radius);
          padding: 12px 16px;
          transition: all 0.2s ease;
        }

        /* Added responsive padding for input wrapper */
        @media (max-width: 768px) {
          .input-wrapper {
            gap: 10px;
            padding: 10px 12px;
          }
        }

        @media (max-width: 480px) {
          .input-wrapper {
            gap: 8px;
            padding: 8px 10px;
          }
        }

        .input-wrapper:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(35, 94, 132, 0.1);
        }

        .message-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 15px;
          color: var(--foreground);
          resize: none;
          min-height: 24px;
          max-height: 120px;
          font-family: inherit;
        }

        /* Added responsive font size for input */
        @media (max-width: 768px) {
          .message-input {
            font-size: 14px;
          }
        }

        @media (max-width: 480px) {
          .message-input {
            font-size: 13px;
          }
        }

        .message-input::placeholder {
          color: var(--muted-foreground);
        }

        .send-button {
          background: var(--primary);
          border: none;
          color: var(--primary-foreground);
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

        /* Added responsive size for send button */
        @media (max-width: 768px) {
          .send-button {
            width: 36px;
            height: 36px;
          }

          .send-button svg {
            width: 14px;
            height: 14px;
          }
        }

        @media (max-width: 480px) {
          .send-button {
            width: 32px;
            height: 32px;
          }

          .send-button svg {
            width: 12px;
            height: 12px;
          }
        }

        .send-button:hover:not(:disabled) {
          background: var(--accent);
          transform: scale(1.05);
        }

        .send-button:disabled {
          background: var(--muted);
          color: var(--muted-foreground);
          cursor: not-allowed;
        }
      `}</style>

      <div className="app-container">
        <div className={`sidebar ${!sidebarVisible ? "hidden" : ""}`}>
          <div className="sidebar-header">
            <div className="brand-header">
              <div className="brand-section">
                <div className="profile-avatar">
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                    alt="Lara AI"
                  />
                </div>
                <div className="brand-title">Lara AI</div>
              </div>
              <button
                className="mobile-close-btn"
                onClick={() => setSidebarVisible(false)}
                title="Chiudi menu"
              >
                ×
              </button>
            </div>
            <button className="new-chat-button" onClick={createNewChat}>
              <span>+</span> Nuova Chat
            </button>
            <div className="memory-toggle-container">
              <label htmlFor="memoryToggle">Usa Memoria</label>
              <label className="switch">
                <input
                  type="checkbox"
                  id="memoryToggle"
                  checked={useMemory}
                  onChange={(e) => setUseMemory(e.target.checked)}
                />
                <span className="slider"></span>
              </label>
            </div>
          </div>

          <div className="sidebar-split-content">
            <div className="chat-list-wrapper">
              <div className="chat-list">
                {sortedChats.map(([chatId, chat]) => {
                  const dateObj = new Date(chat.lastUpdated)
                  const dayNum = dateObj.getDate()
                  const monthStr = monthNames[dateObj.getMonth()]
                  const hourStr = String(dateObj.getHours()).padStart(2, "0")
                  const minuteStr = String(dateObj.getMinutes()).padStart(2, "0")
                  const formattedDate = `${dayNum} ${monthStr} h. ${hourStr}:${minuteStr}`

                  return (
                    <div
                      key={chatId}
                      className={`chat-item ${chatId === currentChatId ? "active" : ""}`}
                      onClick={() => loadChat(chatId)}
                    >
                      <div className="chat-item-content">
                        <div className="chat-item-title">{chat.title || "Nuova Conversazione"}</div>
                        <div className="chat-item-subtitle">{formattedDate}</div>
                      </div>
                      <button
                        className="delete-chat-btn"
                        onClick={(e) => deleteChat(chatId, e)}
                        title="Elimina conversazione"
                      >
                        🗑
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="agents-section">
              <h3 className="agents-title">AGENTI AI:</h3>
              <div className="agents-list">
                <Link href="/tony-ai" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png"
                      alt="Tony"
                    />
                  </div>
                  <span className="agent-name">Tony AI</span>
                </Link>
                <Link href="/aladino-ai" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                      alt="Aladino"
                    />
                  </div>
                  <span className="agent-name">Aladdin AI</span>
                </Link>
                <Link href="/lara-ai" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                      alt="Lara"
                    />
                  </div>
                  <span className="agent-name">Lara AI</span>
                </Link>
                <Link href="/" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png"
                      alt="Simone"
                    />
                  </div>
                  <span className="agent-name">Simone AI</span>
                </Link>
                <Link href="/" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png"
                      alt="Mike"
                    />
                  </div>
                  <span className="agent-name">Mike AI</span>
                </Link>
                <Link href="/" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                      alt="Valentina"
                    />
                  </div>
                  <span className="agent-name">Valentina AI</span>
                </Link>
                <Link href="/" className="agent-item">
                  <div className="agent-avatar">
                    <img src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png" alt="Niko" />
                  </div>
                  <span className="agent-name">Niko AI</span>
                </Link>
                <Link href="/" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png"
                      alt="Jim"
                    />
                  </div>
                  <span className="agent-name">Jim AI</span>
                </Link>
                <Link href="/daniele-ai" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                      alt="Daniele"
                    />
                  </div>
                  <span className="agent-name">Daniele AI</span>
                </Link>
                <Link href="/alex-ai" className="agent-item">
                  <div className="agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png"
                      alt="Alex"
                    />
                  </div>
                  <span className="agent-name">Alex AI</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="chat-container">
          <div className="chat-header">
            <div className="header-left">
              <button
                className="toggle-sidebar-btn"
                onClick={() => setSidebarVisible(!sidebarVisible)}
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
              <div className="chat-title">Lara AI - Social Media Manager</div>
            </div>
            <div className="header-right">
              <Link href="/" className="home-button" title="Home">
                <Home size={20} />
              </Link>
              <div style={{ transform: "scale(1.2)" }}>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10",
                    },
                  }}
                />
              </div>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.sender}`}>
                <div className="message-avatar">
                  <img
                    src={
                      message.sender === "ai"
                        ? "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                        : "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                    }
                    alt={message.sender === "ai" ? "Lara AI" : "User"}
                  />
                </div>
                <div className="message-content">
                  <div className="message-text">
                    {message.text ? (
                      <div dangerouslySetInnerHTML={{ __html: formatMessageText(message.text) }} />
                    ) : (
                      <div className="thinking-dots">
                        <div className="dot"></div>
                        <div className="dot"></div>
                        <div className="dot"></div>
                      </div>
                    )}
                  </div>
                  {message.time && <div className="message-time">{message.time}</div>}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="input-container">
            <div className="input-wrapper">
              <textarea
                ref={textareaRef}
                className="message-input"
                placeholder="Scrivi la tua domanda per Lara..."
                rows={1}
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value)
                  e.target.style.height = "auto"
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
                }}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
              <button
                className="send-button"
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
