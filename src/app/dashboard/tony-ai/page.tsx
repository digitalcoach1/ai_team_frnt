"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import Link from "next/link"
import { UserButton } from "@clerk/nextjs"
import { Home } from 'lucide-react'

export default function TonyAIPage() {
  const [messages, setMessages] = useState<Array<{ text: string; sender: "ai" | "user"; time: string }>>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [useMemory, setUseMemory] = useState(true)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<
    Record<
      string,
      { messages: Array<{ text: string; sender: "ai" | "user"; time: string }>; lastUpdated: string; title: string }
    >
  >({})

  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const CURRENT_NAMESPACE = useRef<string>("")

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/0c898053-01f4-494d-b013-165c8a9023d1/chat?action=sendMessage"

  // Generate UUID
  const generateUUID = (): string => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  // Initialize namespace and load chats
  useEffect(() => {
    let ns = localStorage.getItem("Namespace")
    if (!ns) {
      ns = generateUUID()
      localStorage.setItem("Namespace", ns)
    }
    CURRENT_NAMESPACE.current = ns

    const storedChats = localStorage.getItem("tony-ai-chats")
    if (storedChats) {
      const parsedChats = JSON.parse(storedChats)
      setChats(parsedChats)

      // Load most recent chat
      const sorted = Object.entries(parsedChats).sort(
        ([, a]: any, [, b]: any) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
      )
      if (sorted.length > 0) {
        const [id, chat]: any = sorted[0]
        setCurrentChatId(id)
        setMessages(chat.messages || [])
      } else {
        createInitialMessage()
      }
    } else {
      createInitialMessage()
    }

    const storedMemory = localStorage.getItem("tony-ai-use-memory")
    if (storedMemory !== null) {
      setUseMemory(storedMemory !== "false")
    }

    const storedSidebar = localStorage.getItem("tony-ai-sidebar-visible")
    if (storedSidebar !== null) {
      setSidebarVisible(storedSidebar !== "false")
    }
  }, [])

  const createInitialMessage = () => {
    const initialMsg = {
      text: "Ciao! Sono Tony AI, il tuo consulente vendite digitale con 30 anni di esperienza. Sono qui per aiutarti a migliorare le tue strategie di vendita e raggiungere i tuoi obiettivi commerciali. Come posso supportarti oggi?",
      sender: "ai" as const,
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages([initialMsg])
  }

  // Auto-scroll to bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [messages])

  // Save chat
  useEffect(() => {
    if (messages.length > 0) {
      saveChat()
    }
  }, [messages])

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
    localStorage.setItem("tony-ai-chats", JSON.stringify(updatedChats))
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    localStorage.setItem("tony-ai-session-id", newChatId)
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
    localStorage.setItem("tony-ai-chats", JSON.stringify(updatedChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(updatedChats)
      if (remaining.length > 0) {
        loadChat(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

  const formatMessageText = (text: string): string => {
    let t = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>")
    t = t.replace(
      /`([^`]+?)`/g,
      '<code style="background: rgba(0,0,0,0.1); padding: 2px 4px; border-radius: 3px;">$1</code>',
    )
    t = t.replace(
      /\[([^\]]+?)\]$$(https?:\/\/[^\s)]+)$$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #235E84; text-decoration: underline;">$1</a>',
    )
    t = t.replace(/\n/g, "<br>")
    return t
  }

  const sendMessage = async () => {
    const message = inputValue.trim()
    if (!message || isLoading) return

    setIsLoading(true)
    const userMsg = {
      text: message,
      sender: "user" as const,
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMsg])
    setInputValue("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    // Add thinking message
    const thinkingMsg = {
      text: "...",
      sender: "ai" as const,
      time: "",
      isThinking: true,
    }
    setMessages((prev) => [...prev, thinkingMsg as any])

    try {
      const sessionId = localStorage.getItem("tony-ai-session-id") || "session_" + Date.now()
      localStorage.setItem("tony-ai-session-id", sessionId)

      const res = await fetch(N8N_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          chatInput: message,
          sessionId: sessionId,
          useMemory: useMemory,
          metadata: { namespace: CURRENT_NAMESPACE.current, source: "tony-ai-chat" },
        }),
      })

      if (!res.ok) throw new Error("HTTP error " + res.status)

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No reader available")

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
                lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
                delete (lastMsg as any).isThinking
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
      if (leftover) handleEvent(leftover)

      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg && lastMsg.sender === "ai" && !lastMsg.text) {
          lastMsg.text = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
          lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        }
        delete (lastMsg as any).isThinking
        return newMessages
      })

      if (generatedTitle) {
        saveChat(generatedTitle)
      }
    } catch (err) {
      console.error("Error with streaming request:", err)
      setMessages((prev) => {
        const newMessages = [...prev]
        const lastMsg = newMessages[newMessages.length - 1]
        if (lastMsg && lastMsg.sender === "ai") {
          lastMsg.text = "Errore di connessione. Riprova più tardi."
          lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
          delete (lastMsg as any).isThinking
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

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
  }

  const formatChatDate = (isoDate: string): string => {
    const dateObj = new Date(isoDate)
    const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]
    const dayNum = dateObj.getDate()
    const monthStr = monthNames[dateObj.getMonth()]
    const hourStr = String(dateObj.getHours()).padStart(2, "0")
    const minuteStr = String(dateObj.getMinutes()).padStart(2, "0")
    return `${dayNum} ${monthStr} h. ${hourStr}:${minuteStr}`
  }

  const sortedChats = Object.entries(chats)
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 50)

  return (
    <>
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        
        .tony-scrollbar::-webkit-scrollbar { width: 8px; }
        .tony-scrollbar::-webkit-scrollbar-track { background: #f1f1f1; border-radius: 4px; }
        .tony-scrollbar::-webkit-scrollbar-thumb { background: #235E84; border-radius: 4px; }
        .tony-scrollbar::-webkit-scrollbar-thumb:hover { background: #1a4763; }

        /* Adding responsive styles and mobile menu */
        @media (max-width: 1024px) {
          .tony-main-container { min-width: unset !important; }
          .tony-chat-messages { padding: 40px 60px !important; }
          .tony-input-container { padding: 24px 60px !important; }
        }

        @media (max-width: 768px) {
          .tony-sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            height: 100vh;
            z-index: 1000;
            box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
            transform: translateX(-100%);
          }
          .tony-sidebar.visible {
            transform: translateX(0);
          }
          .tony-chat-messages { padding: 24px 20px !important; }
          .tony-input-container { padding: 20px !important; }
          .tony-header { padding: 16px 20px !important; min-height: 70px !important; }
          .tony-message { max-width: 100% !important; }
          .tony-toggle-desktop { display: none !important; }
          .tony-toggle-mobile { display: flex !important; }
          .tony-close-btn { display: flex !important; }
        }

        @media (max-width: 480px) {
          .tony-header-title { font-size: 16px !important; }
          .tony-chat-messages { padding: 16px !important; }
          .tony-input-container { padding: 16px !important; }
          .tony-avatar { width: 32px !important; height: 32px !important; }
          .tony-message-bubble { padding: 16px !important; font-size: 14px !important; }
          .tony-sidebar { width: 280px !important; min-width: 280px !important; }
        }

        @media (max-width: 360px) {
          .tony-header-title { font-size: 14px !important; }
          .tony-sidebar { width: 260px !important; min-width: 260px !important; }
        }

        @keyframes typing {
          0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      <div
        className="tony-main-container"
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          overflow: "hidden",
          background: "#ffffff",
          minWidth: "900px",
        }}
      >
        {/* Sidebar */}
        <div
          className={`tony-sidebar ${sidebarVisible ? 'visible' : ''}`}
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
          <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0", position: "relative" }}>
            <button
              className="tony-close-btn"
              onClick={() => {
                setSidebarVisible(false)
                localStorage.setItem("tony-ai-sidebar-visible", "false")
              }}
              style={{
                display: "none",
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "4px",
                borderRadius: "4px",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#f1f5f9"
                e.currentTarget.style.color = "#235E84"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent"
                e.currentTarget.style.color = "#64748b"
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>

            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    background: "#235E84",
                  }}
                >
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png"
                    alt="Tony AI"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
                  style={{ fontFamily: "Montserrat, sans-serif", fontSize: "20px", fontWeight: 600, color: "#475569" }}
                >
                  Tony AI
                </div>
              </div>
            </div>

            <button
              onClick={createNewChat}
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
                    localStorage.setItem("tony-ai-use-memory", String(e.target.checked))
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
                    backgroundColor: useMemory ? "#235E84" : "#ccc",
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
                      left: useMemory ? "23px" : "3px",
                      bottom: "3px",
                      backgroundColor: "white",
                      transition: "0.4s",
                      borderRadius: "50%",
                    }}
                  />
                </span>
              </label>
            </div>
          </div>

          {/* Chat List and Agents */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            {/* Chat List */}
            <div
              className="tony-scrollbar"
              style={{ flex: "1 1 50%", overflowY: "auto", padding: "16px 20px", minHeight: "100px" }}
            >
              {sortedChats.map(([id, chat]) => (
                <div
                  key={id}
                  onClick={() => loadChat(id)}
                  style={{
                    padding: "16px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    marginBottom: "2px",
                    background: id === currentChatId ? "#E3F2FD" : "transparent",
                    position: "relative",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
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
                    <div style={{ fontSize: "12px", color: "#64748b" }}>{formatChatDate(chat.lastUpdated)}</div>
                  </div>
                  <button
                    onClick={(e) => deleteChat(id, e)}
                    style={{
                      opacity: 0,
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
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1"
                      e.currentTarget.style.background = "#dc2626"
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0"
                      e.currentTarget.style.background = "#ef4444"
                    }}
                    title="Elimina conversazione"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>

            {/* Agents Section */}
            <div
              style={{
                flex: "1 1 50%",
                minHeight: "150px",
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
                  flexShrink: 0,
                }}
              >
                AGENTI AI:
              </h3>
              <div
                className="tony-scrollbar"
                style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {[
                  {
                    name: "Tony AI",
                    img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png",
                    link: "/tony-ai",
                  },
                  {
                    name: "Aladino AI",
                    img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png",
                    link: "/aladino-ai",
                  },
                  {
                    name: "Lara AI",
                    img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png",
                    link: "https://members.digital-coach.com/products/lara-ai",
                  },
                  {
                    name: "Simone AI",
                    img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png",
                    link: "https://members.digital-coach.com/products/simone-ai",
                  },
                  {
                    name: "Mike AI",
                    img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png",
                    link: "/",
                  },
                  {
                    name: "Alex AI",
                    img: "https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png",
                    link: "/alex-ai",
                  },
                ].map((agent) => (
                  <Link
                    key={agent.name}
                    href={agent.link}
                    target={agent.link.startsWith("http") ? "_blank" : undefined}
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
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#E3F2FD")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                  >
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "#f8fafc",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
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
        </div>

        {/* Chat Container */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ffffff" }}>
          {/* Chat Header */}
          <div
            className="tony-header"
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
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                className="tony-toggle-mobile"
                onClick={() => {
                  setSidebarVisible(true)
                  localStorage.setItem("tony-ai-sidebar-visible", "true")
                }}
                style={{
                  display: "none",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "#ffffff",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 12h18M3 6h18M3 18h18" />
                </svg>
              </button>

              <button
                className="tony-toggle-desktop"
                onClick={() => {
                  setSidebarVisible(!sidebarVisible)
                  localStorage.setItem("tony-ai-sidebar-visible", String(!sidebarVisible))
                }}
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  {sidebarVisible ? (
                    <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  ) : (
                    <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                  )}
                </svg>
              </button>
              <div className="tony-header-title" style={{ fontFamily: "Montserrat, sans-serif", fontSize: "20px", fontWeight: 600 }}>
                Tony AI - Direttore Commerciale
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Link
                href="/"
                style={{
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "10px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
                title="Home"
              >
                <Home size={20} />
              </Link>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "2px solid rgba(255,255,255,0.2)",
                }}
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

          {/* Chat Messages */}
          <div
            ref={chatMessagesRef}
            className="tony-scrollbar tony-chat-messages"
            style={{ flex: 1, overflowY: "auto", padding: "50px 80px", background: "#ffffff", minHeight: 0 }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className="tony-message"
                style={{
                  marginBottom: "32px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  flexDirection: msg.sender === "user" ? "row-reverse" : "row",
                  marginLeft: msg.sender === "user" ? "auto" : "0",
                  maxWidth: "90%",
                }}
              >
                <div
                  className="tony-avatar"
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 600,
                    fontSize: "14px",
                    flexShrink: 0,
                    overflow: "hidden",
                    background: msg.sender === "ai" ? "linear-gradient(135deg, #235E84 0%, #235E84 100%)" : "#E3F2FD",
                    color: msg.sender === "ai" ? "#ffffff" : "#235E84",
                  }}
                >
                  <img
                    src={
                      msg.sender === "ai"
                        ? "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png"
                        : "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                    }
                    alt={msg.sender === "ai" ? "Tony AI" : "Cliente"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>

                <div
                  className="tony-message-bubble"
                  style={{
                    flex: 1,
                    background: msg.sender === "user" ? "#235E84" : "#ffffff",
                    padding: "20px 24px",
                    borderRadius: "12px",
                    border: msg.sender === "user" ? "1px solid #235E84" : "1px solid #e2e8f0",
                    minWidth: "200px",
                    color: msg.sender === "user" ? "#ffffff" : "#334155",
                  }}
                >
                  <div style={{ lineHeight: "1.6", fontSize: "15px" }}>
                    {(msg as any).isThinking ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                        {[0, 1, 2].map((i) => (
                          <div
                            key={i}
                            style={{
                              width: "8px",
                              height: "8px",
                              backgroundColor: "#64748b",
                              borderRadius: "50%",
                              animation: "typing 1.4s infinite ease-in-out both",
                              animationDelay: `${i * 0.2}s`,
                            }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }} />
                    )}
                  </div>
                  {msg.time && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: msg.sender === "user" ? "rgba(255,255,255,0.7)" : "#64748b",
                        marginTop: "8px",
                      }}
                    >
                      {msg.time}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Input Container */}
          <div className="tony-input-container" style={{ padding: "30px 80px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
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
                value={inputValue}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi la tua domanda per Tony..."
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
              />
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim() || isLoading}
                style={{
                  background: !inputValue.trim() || isLoading ? "#cbd5e1" : "#235E84",
                  border: "none",
                  color: "#ffffff",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  cursor: !inputValue.trim() || isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  if (inputValue.trim() && !isLoading) {
                    e.currentTarget.style.background = "#1a4763"
                    e.currentTarget.style.transform = "scale(1.05)"
                  }
                }}
                onMouseLeave={(e) => {
                  if (inputValue.trim() && !isLoading) {
                    e.currentTarget.style.background = "#235E84"
                    e.currentTarget.style.transform = "scale(1)"
                  }
                }}
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
