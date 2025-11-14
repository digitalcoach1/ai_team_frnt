"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { Home } from "lucide-react"

export default function AladinoAI() {
  const [messages, setMessages] = useState<Array<{ text: string; sender: "ai" | "user"; time: string; raw?: string }>>([
    {
      text: "Ciao, sono Aladdin AI. Consulente virtuale per la creazione di nuovi servizi e prodotti ad alta marginalità. Come posso supportarti oggi?",
      sender: "ai",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [useMemory, setUseMemory] = useState(true)
  const [chats, setChats] = useState<Record<string, any>>({})
  const [currentChatId, setCurrentChatId] = useState("default")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const CURRENT_NAMESPACE = useRef<string>("")

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/f3ee3b1a-b98b-4108-9381-dc34e7d34518/chat?action=sendMessage"

  useEffect(() => {
    const generateUUID = () => {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        const v = c === "x" ? r : (r & 0x3) | 0x8
        return v.toString(16)
      })
    }

    let namespace = localStorage.getItem("Namespace")
    if (!namespace) {
      namespace = generateUUID()
      localStorage.setItem("Namespace", namespace)
    }
    CURRENT_NAMESPACE.current = namespace

    const savedSidebarState = localStorage.getItem("aladino-ai-sidebar-visible")
    if (savedSidebarState !== null) {
      setSidebarVisible(savedSidebarState === "true")
    }

    const savedMemoryState = localStorage.getItem("aladino-ai-use-memory")
    if (savedMemoryState !== null) {
      setUseMemory(savedMemoryState !== "false")
    }

    const savedChats = localStorage.getItem("aladino-ai-chats")
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats)
      setChats(parsedChats)

      if (Object.keys(parsedChats).length > 0) {
        const sorted = Object.entries(parsedChats).sort(
          ([, a]: any, [, b]: any) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
        )
        const mostRecentId = sorted[0][0]
        setCurrentChatId(mostRecentId)
        setMessages(parsedChats[mostRecentId].messages || [])
      }
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px"
    }
  }, [inputValue])

  const saveChat = (newTitle?: string) => {
    if (messages.length === 0) return

    let title = newTitle || chats[currentChatId]?.title || "Nuova Conversazione"
    if (!newTitle) {
      const firstUser = messages.find((m) => m.sender === "user")
      if (firstUser) {
        title = (firstUser.text || "Nuova Conversazione").slice(0, 40)
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
    localStorage.setItem("aladino-ai-chats", JSON.stringify(updatedChats))
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    localStorage.setItem("aladino-ai-session-id", newChatId)
    setMessages([
      {
        text: "Ciao, sono Aladdin AI. Consulente virtuale per la creazione di nuovi servizi e prodotti ad alta marginalità. Come posso supportarti oggi?",
        sender: "ai",
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      },
    ])
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
    localStorage.setItem("aladino-ai-chats", JSON.stringify(updatedChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(updatedChats)
      if (remaining.length > 0) {
        loadChat(remaining[0])
      } else {
        createNewChat()
      }
    }
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
      /\[([^\]]+?)\]\$\$(https?:\/\/[^\s)]+)\$\$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #235E84; text-decoration: underline;">$1</a>',
    )
    formatted = formatted.replace(/\n/g, "<br>")

    return formatted
  }

  const sendMessage = async () => {
    if (!inputValue.trim()) return

    const userMessage = {
      text: inputValue,
      sender: "user" as const,
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")
    setIsLoading(true)

    const thinkingMessage = {
      text: "...",
      sender: "ai" as const,
      time: "",
      raw: "",
    }
    setMessages((prev) => [...prev, thinkingMessage])

    try {
      const sessionId = localStorage.getItem("aladino-ai-session-id") || "session_" + Date.now()
      localStorage.setItem("aladino-ai-session-id", sessionId)

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
            source: "aladino-ai-chat",
          },
        }),
      })

      if (!response.ok) throw new Error("HTTP error " + response.status)

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""
      let streamMode: "sse" | "jsonl" | null = null
      let isFirstChunk = true
      let generatedTitle: string | null = null

      const handleEvent = (jsonStr: string) => {
        let obj
        try {
          obj = JSON.parse(jsonStr)
        } catch {
          return
        }

        if (obj.type === "item" && typeof obj.content === "string") {
          if (isFirstChunk) {
            setMessages((prev) => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1] = {
                text: obj.content,
                sender: "ai",
                time: "",
                raw: obj.content,
              }
              return newMessages
            })
            isFirstChunk = false
          } else {
            rawText += obj.content
            setMessages((prev) => {
              const newMessages = [...prev]
              newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                text: rawText,
                raw: rawText,
              }
              return newMessages
            })
          }
        } else if (obj.type === "end" && obj.title) {
          generatedTitle = obj.title
        }
      }

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

      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMessage = newMessages[newMessages.length - 1]
        if (!lastMessage.raw) {
          lastMessage.text = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
          lastMessage.raw = lastMessage.text
        }
        lastMessage.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        return newMessages
      })

      saveChat(generatedTitle || undefined)
    } catch (error) {
      console.error("Error:", error)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (inputValue.trim() && !isLoading) {
        sendMessage()
      }
    }
  }

  const sortedChats = Object.entries(chats)
    .sort(([, a]: any, [, b]: any) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 50)

  const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]

  return (
    <>
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
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
        
        body {
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: var(--background);
          color: var(--foreground);
        }
        
        .aladino-container {
          width: 100vw;
          height: 100vh;
          display: flex;
          overflow: hidden;
          background: var(--background);
        }
        
        .aladino-sidebar {
          width: 320px;
          min-width: 320px;
          background: var(--sidebar);
          border-right: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        .aladino-sidebar.hidden {
          width: 0;
          min-width: 0;
          overflow: hidden;
          border-right: none;
        }
        
        .aladino-sidebar-header {
          padding: 20px;
          border-bottom: 1px solid var(--sidebar-border);
        }
        
        .aladino-brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }
        
        .aladino-brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        /* Added styles for sidebar close button */
        .aladino-sidebar-close-btn {
          display: none;
          background: transparent;
          border: none;
          color: var(--sidebar-foreground);
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
          align-items: center;
          justify-content: center;
          padding: 0;
        }
        
        .aladino-sidebar-close-btn:hover {
          background: var(--muted);
          color: var(--primary);
        }
        
        .aladino-profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: var(--primary);
        }
        
        .aladino-profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .aladino-brand-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--sidebar-foreground);
        }
        
        .aladino-new-chat-button {
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
        
        .aladino-new-chat-button:hover {
          background: var(--accent);
          transform: translateY(-1px);
        }
        
        .aladino-memory-toggle {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 0 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--sidebar-foreground);
        }
        
        .aladino-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }
        
        .aladino-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .aladino-slider {
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
        
        .aladino-slider:before {
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
        
        .aladino-switch input:checked + .aladino-slider {
          background-color: var(--primary);
        }
        
        .aladino-switch input:checked + .aladino-slider:before {
          transform: translateX(20px);
        }
        
        .aladino-sidebar-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-height: 0;
        }
        
        .aladino-chat-list-wrapper {
          flex: 0 1 auto;
          max-height: 40%;
          overflow-y: auto;
          padding: 16px 20px;
        }
        
        .aladino-chat-item {
          padding: 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s ease;
          margin-bottom: 2px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .aladino-chat-item:hover {
          background: var(--sidebar-primary);
        }
        
        .aladino-chat-item.active {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }
        
        .aladino-chat-item-content {
          flex: 1;
        }
        
        .aladino-chat-item-title {
          font-weight: 500;
          font-size: 14px;
          color: var(--sidebar-foreground);
          margin-bottom: 4px;
        }
        
        .aladino-chat-item-subtitle {
          font-size: 12px;
          color: var(--muted-foreground);
        }
        
        .aladino-delete-btn {
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
        
        .aladino-chat-item:hover .aladino-delete-btn {
          opacity: 1;
        }
        
        .aladino-delete-btn:hover {
          background: #dc2626;
        }
        
        .aladino-agents-section {
          flex: 1;
          min-height: 0;
          padding: 16px 20px;
          border-top: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .aladino-agents-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: var(--sidebar-foreground);
          margin-bottom: 16px;
          flex-shrink: 0;
        }
        
        .aladino-agents-list {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .aladino-agent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--sidebar-foreground);
          transition: background-color 0.2s ease;
        }
        
        .aladino-agent-item:hover {
          background-color: var(--sidebar-primary);
        }
        
        .aladino-agent-avatar {
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
        
        .aladino-agent-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .aladino-agent-name {
          font-size: 14px;
          font-weight: 500;
        }
        
        .aladino-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--background);
        }
        
        .aladino-header {
          background: #235E84;
          color: #ffffff;
          padding: 20px 40px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 80px;
        }
        
        .aladino-header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .aladino-header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .aladino-toggle-btn {
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
        
        .aladino-toggle-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .aladino-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
        }
        
        .aladino-home-btn {
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
        
        .aladino-home-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }
        
        .aladino-user-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .aladino-messages {
          flex: 1;
          overflow-y: auto;
          padding: 50px 80px;
          background: var(--background);
        }
        
        .aladino-message {
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
        
        .aladino-message.user {
          flex-direction: row-reverse;
          margin-left: auto;
        }
        
        .aladino-message-avatar {
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
        
        .aladino-message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        
        .aladino-message.ai .aladino-message-avatar {
          background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
          color: var(--primary-foreground);
        }
        
        .aladino-message.user .aladino-message-avatar {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }
        
        .aladino-message-content {
          flex: 1;
          background: #ffffff;
          padding: 20px 24px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          min-width: 200px;
        }
        
        .aladino-message.user .aladino-message-content {
          background: #235E84;
          color: #ffffff;
          border-color: #235E84;
        }
        
        .aladino-message-text {
          color: var(--card-foreground);
          line-height: 1.6;
          font-size: 15px;
        }
        
        .aladino-message.user .aladino-message-text {
          color: #ffffff;
        }
        
        .aladino-message-time {
          font-size: 12px;
          color: var(--muted-foreground);
          margin-top: 8px;
        }
        
        .aladino-message.user .aladino-message-time {
          color: rgba(255, 255, 255, 0.7);
        }
        
        .aladino-thinking-dots {
          display: flex;
          align-items: center;
          gap: 5px;
        }
        
        .aladino-thinking-dots .dot {
          width: 8px;
          height: 8px;
          background-color: var(--muted-foreground);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }
        
        .aladino-thinking-dots .dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .aladino-thinking-dots .dot:nth-child(3) {
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
        
        .aladino-input-container {
          padding: 30px 80px;
          border-top: 1px solid var(--border);
          background: var(--background);
        }
        
        .aladino-input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          background: var(--card);
          border: 2px solid var(--border);
          border-radius: var(--radius);
          padding: 12px 16px;
          transition: all 0.2s ease;
        }
        
        .aladino-input-wrapper:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(35, 94, 132, 0.1);
        }
        
        .aladino-file-btn {
          background: transparent;
          border: none;
          color: var(--muted-foreground);
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
        
        .aladino-file-btn:hover {
          background: var(--muted);
          color: var(--primary);
        }
        
        .aladino-input {
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
        
        .aladino-input::placeholder {
          color: var(--muted-foreground);
        }
        
        .aladino-send-btn {
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
        
        .aladino-send-btn:hover:not(:disabled) {
          background: var(--accent);
          transform: scale(1.05);
        }
        
        .aladino-send-btn:disabled {
          background: var(--muted);
          color: var(--muted-foreground);
          cursor: not-allowed;
        }
        
        /* Custom scrollbar styling */
        .aladino-chat-list-wrapper::-webkit-scrollbar,
        .aladino-agents-list::-webkit-scrollbar {
          width: 6px;
        }
        
        .aladino-chat-list-wrapper::-webkit-scrollbar-track,
        .aladino-agents-list::-webkit-scrollbar-track {
          background: transparent;
        }
        
        .aladino-chat-list-wrapper::-webkit-scrollbar-thumb,
        .aladino-agents-list::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 3px;
        }
        
        .aladino-chat-list-wrapper::-webkit-scrollbar-thumb:hover,
        .aladino-agents-list::-webkit-scrollbar-thumb:hover {
          background: var(--muted-foreground);
        }
        
        /* Added responsive breakpoints for all screen sizes */
        
        /* Tablet and smaller devices (max-width: 1024px) */
        @media (max-width: 1024px) {
          .aladino-sidebar {
            width: 280px;
            min-width: 280px;
          }
          
          .aladino-header {
            padding: 16px 24px;
            min-height: 70px;
          }
          
          .aladino-title {
            font-size: 18px;
          }
          
          .aladino-messages {
            padding: 40px 40px;
          }
          
          .aladino-input-container {
            padding: 20px 40px;
          }
          
          .aladino-message {
            max-width: 95%;
          }
        }
        
        /* Mobile devices (max-width: 768px) */
        @media (max-width: 768px) {
          /* Added mobile menu bar button styles */
          .aladino-mobile-menu-btn {
            display: flex;
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
          
          .aladino-mobile-menu-btn:hover {
            background: rgba(255, 255, 255, 0.2);
          }
          
          /* Show close button on mobile sidebar */
          .aladino-sidebar-close-btn {
            display: flex;
          }
          
          /* Show hamburger menu on mobile, hide toggle button */
          .aladino-mobile-menu-btn {
            display: flex;
          }
          
          .aladino-toggle-btn {
            display: none;
          }
          
          .aladino-sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            max-width: 320px;
            height: 100vh;
            z-index: 1000;
            box-shadow: 2px 0 12px rgba(0, 0, 0, 0.15);
          }
          
          .aladino-sidebar.hidden {
            transform: translateX(-100%);
          }
          
          .aladino-header {
            padding: 12px 16px;
            min-height: 60px;
          }
          
          .aladino-title {
            font-size: 16px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 180px;
          }
          
          .aladino-messages {
            padding: 24px 16px;
          }
          
          .aladino-input-container {
            padding: 16px;
          }
          
          .aladino-message {
            gap: 12px;
            margin-bottom: 24px;
            max-width: 100%;
          }
          
          .aladino-message-avatar {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }
          
          .aladino-message-content {
            padding: 16px;
          }
          
          .aladino-message-text {
            font-size: 14px;
          }
          
          .aladino-input-wrapper {
            padding: 10px 12px;
          }
          
          .aladino-input {
            font-size: 14px;
          }
          
          .aladino-send-btn,
          .aladino-file-btn {
            width: 36px;
            height: 36px;
          }
        }
        
        /* Small mobile devices (max-width: 480px) */
        @media (max-width: 480px) {
          .aladino-sidebar {
            max-width: 280px;
          }
          
          .aladino-sidebar-header {
            padding: 16px;
          }
          
          .aladino-brand-title {
            font-size: 18px;
          }
          
          .aladino-profile-avatar {
            width: 36px;
            height: 36px;
          }
          
          .aladino-new-chat-button {
            padding: 12px 16px;
            font-size: 13px;
          }
          
          .aladino-header {
            padding: 10px 12px;
            min-height: 56px;
          }
          
          .aladino-title {
            font-size: 14px;
            max-width: 140px;
          }
          
          .aladino-home-btn,
          .aladino-toggle-btn {
            width: 36px;
            height: 36px;
            padding: 8px;
          }
          
          .aladino-user-btn {
            width: 36px;
            height: 36px;
          }
          
          .aladino-messages {
            padding: 16px 12px;
          }
          
          .aladino-message {
            gap: 8px;
            margin-bottom: 20px;
          }
          
          .aladino-message-avatar {
            width: 28px;
            height: 28px;
          }
          
          .aladino-message-content {
            padding: 12px 14px;
          }
          
          .aladino-message-text {
            font-size: 13px;
          }
          
          .aladino-message-time {
            font-size: 11px;
          }
          
          .aladino-input-container {
            padding: 12px;
          }
          
          .aladino-input-wrapper {
            padding: 8px 10px;
          }
          
          .aladino-input {
            font-size: 13px;
          }
          
          .aladino-send-btn,
          .aladino-file-btn {
            width: 32px;
            height: 32px;
          }
          
          .aladino-chat-list-wrapper,
          .aladino-agents-section {
            padding: 12px 16px;
          }
          
          .aladino-chat-item {
            padding: 12px;
          }
          
          .aladino-chat-item-title {
            font-size: 13px;
          }
          
          .aladino-chat-item-subtitle {
            font-size: 11px;
          }
          
          .aladino-agent-item {
            padding: 8px 10px;
          }
          
          .aladino-agent-avatar {
            width: 28px;
            height: 28px;
          }
          
          .aladino-agent-name {
            font-size: 13px;
          }
        }
        
        /* Extra small devices (max-width: 360px) */
        @media (max-width: 360px) {
          .aladino-title {
            max-width: 100px;
          }
          
          .aladino-header-right {
            gap: 8px;
          }
          
          .aladino-message-content {
            padding: 10px 12px;
          }
          
          .aladino-message-text {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="aladino-container">
        <div className={`aladino-sidebar ${!sidebarVisible ? "hidden" : ""}`}>
          <div className="aladino-sidebar-header">
            <div className="aladino-brand-header">
              <div className="aladino-brand-section">
                <div className="aladino-profile-avatar">
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                    alt="Aladino AI"
                  />
                </div>
                <div className="aladino-brand-title">Aladino AI</div>
              </div>
              <button
                className="aladino-sidebar-close-btn"
                onClick={() => {
                  setSidebarVisible(false)
                  localStorage.setItem("aladino-ai-sidebar-visible", "false")
                }}
                title="Chiudi"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <button className="aladino-new-chat-button" onClick={createNewChat}>
              <span>+</span> Nuova Chat
            </button>
            <div className="aladino-memory-toggle">
              <label htmlFor="memoryToggle">Usa Memoria</label>
              <label className="aladino-switch">
                <input
                  type="checkbox"
                  id="memoryToggle"
                  checked={useMemory}
                  onChange={(e) => {
                    setUseMemory(e.target.checked)
                    localStorage.setItem("aladino-ai-use-memory", String(e.target.checked))
                  }}
                />
                <span className="aladino-slider"></span>
              </label>
            </div>
          </div>

          <div className="aladino-sidebar-content">
            <div className="aladino-chat-list-wrapper">
              {sortedChats.map(([id, chat]: any) => {
                const dateObj = new Date(chat.lastUpdated)
                const dayNum = dateObj.getDate()
                const monthStr = monthNames[dateObj.getMonth()]
                const hourStr = String(dateObj.getHours()).padStart(2, "0")
                const minuteStr = String(dateObj.getMinutes()).padStart(2, "0")
                const formattedDate = `${dayNum} ${monthStr} h. ${hourStr}:${minuteStr}`

                return (
                  <div
                    key={id}
                    className={`aladino-chat-item ${id === currentChatId ? "active" : ""}`}
                    onClick={() => loadChat(id)}
                  >
                    <div className="aladino-chat-item-content">
                      <div className="aladino-chat-item-title">{chat.title || "Nuova Conversazione"}</div>
                      <div className="aladino-chat-item-subtitle">{formattedDate}</div>
                    </div>
                    <button
                      className="aladino-delete-btn"
                      onClick={(e) => deleteChat(id, e)}
                      title="Elimina conversazione"
                    >
                      🗑
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="aladino-agents-section">
              <h3 className="aladino-agents-title">AGENTI AI:</h3>
              <div className="aladino-agents-list">
                <a
                  href="https://members.digital-coach.com/products/tony-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png"
                      alt="Tony"
                    />
                  </div>
                  <span className="aladino-agent-name">Tony AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/aladdin-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                      alt="Aladino"
                    />
                  </div>
                  <span className="aladino-agent-name">Aladdin AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/lara-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                      alt="Lara"
                    />
                  </div>
                  <span className="aladino-agent-name">Lara AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/simone-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png"
                      alt="Simone"
                    />
                  </div>
                  <span className="aladino-agent-name">Simone AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/mike-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png"
                      alt="Mike ai"
                    />
                  </div>
                  <span className="aladino-agent-name">Mike AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/valentina-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                      alt="Valentina ai"
                    />
                  </div>
                  <span className="aladino-agent-name">Valentina AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/niko-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png" alt="Niko ai" />
                  </div>
                  <span className="aladino-agent-name">Niko AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/jim-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png"
                      alt="Jim AI"
                    />
                  </div>
                  <span className="aladino-agent-name">Jim AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/daniele-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                      alt="Daniele ai"
                    />
                  </div>
                  <span className="aladino-agent-name">Daniele AI</span>
                </a>
                <a
                  href="https://members.digital-coach.com/products/alex-ai-2-0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aladino-agent-item"
                >
                  <div className="aladino-agent-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png"
                      alt="Alex ai"
                    />
                  </div>
                  <span className="aladino-agent-name">Alex AI</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="aladino-main">
          <div className="aladino-header">
            <div className="aladino-header-left">
              <button
                className="aladino-mobile-menu-btn"
                onClick={() => {
                  setSidebarVisible(!sidebarVisible)
                  localStorage.setItem("aladino-ai-sidebar-visible", String(!sidebarVisible))
                }}
                title="Menu"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                className="aladino-toggle-btn"
                onClick={() => {
                  setSidebarVisible(!sidebarVisible)
                  localStorage.setItem("aladino-ai-sidebar-visible", String(!sidebarVisible))
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
              <div className="aladino-title">Aladino AI - Creatore di nuove offerte e prodotti</div>
            </div>
            <div className="aladino-header-right">
              <Link href="/" className="aladino-home-btn" title="Home">
                <Home size={20} />
              </Link>
              <div className="aladino-user-btn">
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

          <div className="aladino-messages">
            {messages.map((message, index) => (
              <div key={index} className={`aladino-message ${message.sender}`}>
                <div className="aladino-message-avatar">
                  <img
                    src={
                      message.sender === "ai"
                        ? "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                        : "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                    }
                    alt={message.sender === "ai" ? "Aladino AI" : "Cliente"}
                  />
                </div>
                <div className="aladino-message-content">
                  {message.text === "..." ? (
                    <div className="aladino-thinking-dots">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="aladino-message-text"
                        dangerouslySetInnerHTML={{ __html: formatMessageText(message.text) }}
                      />
                      {message.time && <div className="aladino-message-time">{message.time}</div>}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="aladino-input-container">
            <div className="aladino-input-wrapper">
              <textarea
                ref={textareaRef}
                className="aladino-input"
                placeholder="Scrivi la tua domanda per Aladino..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                disabled={isLoading}
              />
              <button
                className="aladino-send-btn"
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
