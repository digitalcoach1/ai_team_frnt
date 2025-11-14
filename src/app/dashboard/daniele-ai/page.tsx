"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { Home } from "lucide-react"

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

export default function DanieleAIPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [chats, setChats] = useState<{ [key: string]: Chat }>({})
  const [currentChatId, setCurrentChatId] = useState("default")
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [useMemory, setUseMemory] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const CURRENT_NAMESPACE = useRef("")

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/b53858eb-1e73-4798-80ae-13c0d3323f1a/chat?action=sendMessage"

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

    const storedChats = localStorage.getItem("daniele-ai-chats")
    if (storedChats) {
      const parsedChats = JSON.parse(storedChats)
      setChats(parsedChats)

      const sortedChats = (Object.entries(parsedChats) as [string, Chat][]).sort(
        ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
      )

      if (sortedChats.length > 0) {
        const [chatId, chat] = sortedChats[0]
        setCurrentChatId(chatId)
        setMessages(chat.messages || [])
      } else {
        createInitialMessage()
      }
    } else {
      createInitialMessage()
    }

    const storedMemory = localStorage.getItem("daniele-ai-use-memory")
    setUseMemory(storedMemory !== "false")

    const storedSidebarVisible = localStorage.getItem("daniele-ai-sidebar-visible")
    setSidebarVisible(storedSidebarVisible !== "false")
  }, [])

  const createInitialMessage = () => {
    const initialMessage: Message = {
      text: "Ciao! Sono Daniele AI, il tuo direct response copywriter di livello mondiale con oltre 30 anni di esperienza nel settore. Come posso supportarti oggi?",
      sender: "ai",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages([initialMessage])
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (messages.length > 0) {
      saveCurrentChat()
    }
  }, [messages])

  const saveCurrentChat = (newTitle?: string) => {
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
    localStorage.setItem("daniele-ai-chats", JSON.stringify(updatedChats))
  }

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId)
    const chat = chats[chatId]
    setMessages(chat.messages || [])
  }

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Sei sicuro di voler eliminare questa conversazione?")) return

    const updatedChats = { ...chats }
    delete updatedChats[chatId]
    setChats(updatedChats)
    localStorage.setItem("daniele-ai-chats", JSON.stringify(updatedChats))

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
    localStorage.setItem("daniele-ai-session-id", newChatId)
    createInitialMessage()
  }

  const formatMessageText = (text: string) => {
    let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>")
    formatted = formatted.replace(
      /`([^`]+?)`/g,
      '<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>',
    )
    formatted = formatted.replace(
      /\[([^\]]+?)\]$$(https?:\/\/[^\s)]+)$$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #235E84; text-decoration: underline;">$1</a>',
    )
    formatted = formatted.replace(/\n/g, "<br>")

    return formatted
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      text: input.trim(),
      sender: "user",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    const thinkingMessage: Message = {
      text: "...",
      sender: "ai",
      time: "",
    }
    setMessages((prev) => [...prev, thinkingMessage])

    try {
      const sessionId = localStorage.getItem("daniele-ai-session-id") || "session_" + Date.now()
      localStorage.setItem("daniele-ai-session-id", sessionId)

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
          metadata: { namespace: CURRENT_NAMESPACE.current, source: "daniele-ai-chat" },
        }),
      })

      if (!response.ok) throw new Error("HTTP error " + response.status)

      const reader = response.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""
      let streamMode: "sse" | "jsonl" | null = null
      let generatedTitle: string | null = null

      const handleEvent = (jsonStr: string) => {
        try {
          const obj = JSON.parse(jsonStr)
          if (obj.type === "item" && typeof obj.content === "string") {
            rawText += obj.content
            setMessages((prev) => {
              const newMessages = [...prev]
              const lastMsg = newMessages[newMessages.length - 1]
              if (lastMsg && lastMsg.sender === "ai") {
                lastMsg.text = rawText
                lastMsg.time = new Date().toLocaleTimeString("it-IT", {
                  hour: "2-digit",
                  minute: "2-digit",
                })
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

      while (reader) {
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
            if (dataLines.length) {
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
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg && lastMsg.sender === "ai" && lastMsg.text === "...") {
          lastMsg.text = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
          lastMsg.time = new Date().toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          })
        }
        return newMessages
      })

      if (generatedTitle) {
        saveCurrentChat(generatedTitle)
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg && lastMsg.sender === "ai") {
          lastMsg.text = "Errore di connessione. Riprova più tardi."
          lastMsg.time = new Date().toLocaleTimeString("it-IT", {
            hour: "2-digit",
            minute: "2-digit",
          })
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
      sendMessage()
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
  }

  const sortedChats = (Object.entries(chats) as [string, Chat][]).sort(
    ([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
  )

  return (
    <>
      <style jsx global>{`
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }

        ::-webkit-scrollbar-track {
          background: #f1f5f9;
        }

        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }

        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
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

        @media (max-width: 1024px) {
          .sidebar {
            width: 280px !important;
            min-width: 280px !important;
          }
          .chat-messages {
            padding: 30px 40px !important;
          }
          .input-container {
            padding: 20px 40px !important;
          }
        }

        @media (max-width: 768px) {
          .sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            height: 100vh;
            z-index: 1000;
            transform: translateX(-100%);
            box-shadow: none;
          }
          .sidebar.visible {
            transform: translateX(0);
            box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
          }
          .chat-header {
            padding: 16px 20px !important;
            min-height: 70px !important;
          }
          .chat-header-title {
            font-size: 16px !important;
          }
          .chat-messages {
            padding: 20px 16px !important;
          }
          .message-container {
            max-width: 100% !important;
          }
          .input-container {
            padding: 16px !important;
          }
          .hamburger-menu {
            display: flex !important;
          }
          .desktop-toggle {
            display: none !important;
          }
          .close-sidebar-btn {
            display: flex !important;
          }
        }

        @media (max-width: 480px) {
          .chat-header {
            padding: 12px 16px !important;
            min-height: 60px !important;
          }
          .chat-header-title {
            font-size: 14px !important;
          }
          .sidebar-header {
            padding: 16px !important;
          }
          .sidebar-title {
            font-size: 18px !important;
          }
          .avatar-large {
            width: 32px !important;
            height: 32px !important;
          }
          .avatar-small {
            width: 32px !important;
            height: 32px !important;
          }
          .new-chat-btn {
            padding: 12px 16px !important;
            font-size: 13px !important;
          }
          .chat-messages {
            padding: 16px 12px !important;
          }
          .message-bubble {
            padding: 16px 18px !important;
            font-size: 14px !important;
          }
          .input-container {
            padding: 12px !important;
          }
        }

        @media (max-width: 360px) {
          .chat-header-title {
            font-size: 12px !important;
          }
          .sidebar-title {
            font-size: 16px !important;
          }
          .avatar-large {
            width: 28px !important;
            height: 28px !important;
          }
          .message-bubble {
            padding: 14px 16px !important;
            font-size: 13px !important;
          }
        }

        .hamburger-menu {
          display: none;
        }

        .close-sidebar-btn {
          display: none;
        }
      `}</style>

      <div style={{ width: "100%", height: "100vh", display: "flex", overflow: "hidden", background: "#ffffff" }}>
        {/* Sidebar */}
        <div
          className={`sidebar ${sidebarVisible ? "visible" : ""}`}
          style={{
            width: sidebarVisible ? "320px" : "0",
            minWidth: sidebarVisible ? "320px" : "0",
            background: "#ffffff",
            borderRight: sidebarVisible ? "1px solid #e2e8f0" : "none",
            display: "flex",
            flexDirection: "column",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
          }}
        >
          {/* Sidebar Header */}
          <div className="sidebar-header" style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  className="avatar-large"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    background: "#235E84",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                    alt="Daniele AI"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
                  className="sidebar-title"
                  style={{ fontFamily: "Montserrat, sans-serif", fontSize: "20px", fontWeight: 600, color: "#475569" }}
                >
                  Daniele AI
                </div>
              </div>
              <button
                className="close-sidebar-btn"
                onClick={() => {
                  setSidebarVisible(false)
                  localStorage.setItem("daniele-ai-sidebar-visible", "false")
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#475569",
                  cursor: "pointer",
                  padding: "8px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  lineHeight: 1,
                }}
                title="Chiudi menu"
              >
                ×
              </button>
            </div>

            <button
              onClick={createNewChat}
              className="new-chat-btn"
              style={{
                background: "#235E84",
                border: "none",
                color: "#ffffff",
                padding: "14px 20px",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                width: "100%",
                transition: "all 0.2s ease",
              }}
            >
              <span>+</span> Nuova Chat
            </button>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "16px",
                fontSize: "14px",
                fontWeight: 500,
                color: "#475569",
              }}
            >
              <label htmlFor="memoryToggle">Usa Memoria</label>
              <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px" }}>
                <input
                  type="checkbox"
                  id="memoryToggle"
                  checked={useMemory}
                  onChange={(e) => {
                    setUseMemory(e.target.checked)
                    localStorage.setItem("daniele-ai-use-memory", String(e.target.checked))
                  }}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span
                  style={{
                    position: "absolute",
                    cursor: "pointer",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: useMemory ? "#235E84" : "#ccc",
                    transition: "0.4s",
                    borderRadius: "24px",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      content: '""',
                      height: "18px",
                      width: "18px",
                      left: "3px",
                      bottom: "3px",
                      background: "white",
                      transition: "0.4s",
                      borderRadius: "50%",
                      transform: useMemory ? "translateX(20px)" : "translateX(0)",
                    }}
                  />
                </span>
              </label>
            </div>
          </div>

          {/* Chat List */}
          <div style={{ flex: "0 1 auto", maxHeight: "40%", overflowY: "auto", padding: "16px 20px", minHeight: 0 }}>
            {sortedChats.map(([id, chat]) => {
              const dateObj = new Date(chat.lastUpdated)
              const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
              const formattedDate = `${dateObj.getDate()} ${monthNames[dateObj.getMonth()]} h. ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`

              return (
                <div
                  key={id}
                  onClick={() => loadChat(id)}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    marginBottom: "2px",
                    background: id === currentChatId ? "#E3F2FD" : "transparent",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (id !== currentChatId) e.currentTarget.style.background = "#E3F2FD"
                  }}
                  onMouseLeave={(e) => {
                    if (id !== currentChatId) e.currentTarget.style.background = "transparent"
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: "14px", color: "#475569", marginBottom: "4px" }}>
                      {chat.title || "Nuova Conversazione"}
                    </div>
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{formattedDate}</div>
                  </div>
                  <button
                    onClick={(e) => deleteChat(id, e)}
                    style={{
                      background: "#ef4444",
                      border: "none",
                      color: "white",
                      width: "24px",
                      height: "24px",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                    }}
                    title="Elimina conversazione"
                  >
                    🗑
                  </button>
                </div>
              )
            })}
          </div>

          {/* Agents Section */}
          <div
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              padding: "16px 20px",
              borderTop: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <h3
              style={{
                fontFamily: "Montserrat, sans-serif",
                fontSize: "16px",
                fontWeight: 600,
                color: "#475569",
                marginBottom: "16px",
              }}
            >
              AGENTI AI:
            </h3>
            <div
              style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", minHeight: 0 }}
            >
              {[
                {
                  name: "Tony AI",
                  img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png",
                  href: "/tony-ai",
                },
                {
                  name: "Aladino AI",
                  img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png",
                  href: "/aladino-ai",
                },
                {
                  name: "Lara AI",
                  img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png",
                  href: "https://members.digital-coach.com/products/lara-ai",
                },
                {
                  name: "Simone AI",
                  img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png",
                  href: "https://members.digital-coach.com/products/simone-ai",
                },
                {
                  name: "Mike AI",
                  img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png",
                  href: "/",
                },
                {
                  name: "Alex AI",
                  img: "https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png",
                  href: "/alex-ai",
                },
              ].map((agent) => (
                <Link
                  key={agent.name}
                  href={agent.href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: "#475569",
                    transition: "background-color 0.2s ease",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#E3F2FD")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      overflow: "hidden",
                      flexShrink: 0,
                    }}
                  >
                    <img
                      src={agent.img || "/placeholder.svg"}
                      alt={agent.name}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>{agent.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ffffff" }}>
          {/* Chat Header */}
          <div
            className="chat-header"
            style={{
              background: "#235E84",
              color: "#ffffff",
              padding: "20px 40px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              minHeight: "80px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, minWidth: 0 }}>
              <button
                className="hamburger-menu"
                onClick={() => {
                  setSidebarVisible(true)
                  localStorage.setItem("daniele-ai-sidebar-visible", "true")
                }}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "#ffffff",
                  display: "none",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
                title="Mostra menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                className="desktop-toggle"
                onClick={() => {
                  setSidebarVisible(!sidebarVisible)
                  localStorage.setItem("daniele-ai-sidebar-visible", String(!sidebarVisible))
                }}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
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
              <div
                className="chat-header-title"
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: "20px",
                  fontWeight: 600,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                Daniele AI - Copywriter per Vendere (Direct Response)
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
              <Link
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(255, 255, 255, 0.1)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  color: "#ffffff",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                title="Home"
              >
                <Home size={20} />
              </Link>
              <div
                className="avatar-small"
                style={{ width: "40px", height: "40px", borderRadius: "50%", overflow: "hidden" }}
              >
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

          {/* Messages */}
          <div
            className="chat-messages"
            style={{ flex: 1, overflowY: "auto", padding: "50px 80px", background: "#ffffff" }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                className="message-container"
                style={{
                  marginBottom: "32px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  animation: "fadeInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                  maxWidth: "90%",
                  flexDirection: message.sender === "user" ? "row-reverse" : "row",
                  marginLeft: message.sender === "user" ? "auto" : "0",
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    background:
                      message.sender === "ai" ? "linear-gradient(135deg, #235E84 0%, #235E84 100%)" : "#E3F2FD",
                    color: message.sender === "ai" ? "#ffffff" : "#235E84",
                    flexShrink: 0,
                    fontWeight: 600,
                    fontSize: "14px",
                  }}
                >
                  <img
                    src={
                      message.sender === "ai"
                        ? "https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                        : "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                    }
                    alt={message.sender === "ai" ? "Daniele AI" : "Cliente"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div
                  className="message-bubble"
                  style={{
                    flex: 1,
                    background: message.sender === "user" ? "#235E84" : "#ffffff",
                    padding: "20px 24px",
                    borderRadius: "12px",
                    border: message.sender === "user" ? "1px solid #235E84" : "1px solid #e2e8f0",
                    minWidth: "200px",
                  }}
                >
                  {message.text === "..." ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: "8px",
                            height: "8px",
                            background: "#64748b",
                            borderRadius: "50%",
                            animation: "typing 1.4s infinite ease-in-out both",
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          color: message.sender === "user" ? "#ffffff" : "#334155",
                          lineHeight: 1.6,
                          fontSize: "15px",
                        }}
                        dangerouslySetInnerHTML={{ __html: formatMessageText(message.text) }}
                      />
                      {message.time && (
                        <div
                          style={{
                            fontSize: "12px",
                            color: message.sender === "user" ? "rgba(255,255,255,0.7)" : "#64748b",
                            marginTop: "8px",
                          }}
                        >
                          {message.time}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            className="input-container"
            style={{ padding: "30px 80px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "12px",
                background: "#ffffff",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px 16px",
                transition: "all 0.2s ease",
              }}
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi la tua domanda per Daniele..."
                disabled={isLoading}
                style={{
                  flex: 1,
                  border: "none",
                  outline: "none",
                  background: "transparent",
                  fontSize: "15px",
                  color: "#475569",
                  resize: "none",
                  minHeight: "24px",
                  maxHeight: "120px",
                  fontFamily: "inherit",
                }}
                rows={1}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || isLoading}
                style={{
                  background: input.trim() && !isLoading ? "#235E84" : "#cbd5e1",
                  border: "none",
                  color: "#ffffff",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  cursor: input.trim() && !isLoading ? "pointer" : "not-allowed",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  transition: "all 0.2s ease",
                }}
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

