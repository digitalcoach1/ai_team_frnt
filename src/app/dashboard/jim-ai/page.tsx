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

export default function JimAIPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [useMemory, setUseMemory] = useState(true)
  const [chats, setChats] = useState<Record<string, Chat>>({})
  const [currentChatId, setCurrentChatId] = useState("default")
  const [currentNamespace] = useState(() => {
    if (typeof window !== "undefined") {
      let ns = localStorage.getItem("Namespace")
      if (!ns) {
        ns = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          const v = c === "x" ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
        localStorage.setItem("Namespace", ns)
      }
      return ns
    }
    return "default-namespace"
  })

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLTextAreaElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedChats = localStorage.getItem("jim-ai-chats")
      if (savedChats) {
        const parsedChats = JSON.parse(savedChats)
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
      } else {
        createInitialMessage()
      }

      const savedSidebarVisible = localStorage.getItem("jim-ai-sidebar-visible")
      if (savedSidebarVisible !== null) {
        setSidebarVisible(savedSidebarVisible !== "false")
      }

      const savedUseMemory = localStorage.getItem("jim-ai-use-memory")
      if (savedUseMemory !== null) {
        setUseMemory(savedUseMemory !== "false")
      }
    }
  }, [])

  const createInitialMessage = () => {
    const initialMessage: Message = {
      text: "Ciao! Sono Jim AI, il tuo Sales Coach per moltiplicare le vendite con allenamenti mirati e pratici. Come posso supportarti oggi?",
      sender: "ai",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages([initialMessage])
  }

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
    localStorage.setItem("jim-ai-chats", JSON.stringify(updatedChats))
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
    localStorage.setItem("jim-ai-chats", JSON.stringify(updatedChats))

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
    localStorage.setItem("jim-ai-session-id", newChatId)
    createInitialMessage()
  }

  const formatMessageText = (text: string) => {
    let t = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>")
    t = t.replace(
      /`([^`]+?)`/g,
      '<code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>',
    )
    t = t.replace(
      /\[([^\]]+?)\]\$\$(https?:\/\/[^\s)]+)\$\$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #235E84; text-decoration: underline;">$1</a>',
    )
    t = t.replace(/\n/g, "<br>")

    return t
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
      text: "...",
      sender: "ai",
      time: "",
    }
    setMessages((prev) => [...prev, thinkingMessage])

    try {
      const sessionId = localStorage.getItem("jim-ai-session-id") || "session_" + Date.now()
      localStorage.setItem("jim-ai-session-id", sessionId)

      const response = await fetch(
        "https://n8n-c2lq.onrender.com/webhook/bdc4cf07-48f7-4144-ac75-659ab5197b2b/chat?action=sendMessage",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify({
            chatInput: inputValue,
            sessionId: sessionId,
            useMemory: useMemory,
            metadata: { namespace: currentNamespace, source: "jim-ai-chat" },
          }),
        },
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

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

      setTimeout(() => {
        saveChat(generatedTitle || undefined)
      }, 100)
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("jim-ai-sidebar-visible", String(sidebarVisible))
    }
  }, [sidebarVisible])

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("jim-ai-use-memory", String(useMemory))
    }
  }, [useMemory])

  useEffect(() => {
    saveChat()
  }, [messages])

  const sortedChats = Object.entries(chats)
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 50)

  const monthNames = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"]

  return (
    <>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&family=Open+Sans:wght@400;500;600&display=swap');
        
        body {
          margin: 0;
          padding: 0;
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        /* Added responsive breakpoints for mobile and tablet */
        @media (max-width: 768px) {
          body {
            font-size: 14px;
          }
        }
      `}</style>

      <div
        style={{
          width: "100%",
          height: "100vh",
          display: "flex",
          overflow: "hidden",
          background: "#ffffff",
          fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
            width: sidebarVisible ? "320px" : "0",
            minWidth: sidebarVisible ? "320px" : "0",
            background: "#ffffff",
            borderRight: sidebarVisible ? "1px solid #e2e8f0" : "none",
            display: "flex",
            flexDirection: "column",
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            overflow: "hidden",
            position: "relative",
            zIndex: 40,
          }}
          className="sidebar-responsive"
        >
          {/* Sidebar Header */}
          <div style={{ padding: "20px", borderBottom: "1px solid #e2e8f0" }}>
            <div
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
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
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png"
                    alt="Jim AI"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
                  style={{ fontFamily: "Montserrat, sans-serif", fontSize: "20px", fontWeight: 600, color: "#475569" }}
                >
                  Jim AI
                </div>
              </div>
              <button
                onClick={() => setSidebarVisible(false)}
                className="mobile-close-btn"
                style={{
                  display: "none",
                  background: "rgba(35, 94, 132, 0.1)",
                  border: "none",
                  color: "#235E84",
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  cursor: "pointer",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "18px",
                  fontWeight: 600,
                }}
              >
                ×
              </button>
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
              onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
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
                  onChange={(e) => setUseMemory(e.target.checked)}
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
              style={{
                flex: "1 1 auto",
                maxHeight: "40%",
                overflowY: "auto",
                padding: "16px 20px",
                minHeight: "100px",
              }}
            >
              {sortedChats.map(([chatId, chat]) => {
                const dateObj = new Date(chat.lastUpdated)
                const dayNum = dateObj.getDate()
                const monthStr = monthNames[dateObj.getMonth()]
                const hourStr = String(dateObj.getHours()).padStart(2, "0")
                const minuteStr = String(dateObj.getMinutes()).padStart(2, "0")
                const formattedDate = `${dayNum} ${monthStr}, ${hourStr}:${minuteStr}`

                return (
                  <div
                    key={chatId}
                    onClick={() => loadChat(chatId)}
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      marginBottom: "2px",
                      background: chatId === currentChatId ? "#E3F2FD" : "transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "background 0.2s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (chatId !== currentChatId) {
                        e.currentTarget.style.background = "#E3F2FD"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (chatId !== currentChatId) {
                        e.currentTarget.style.background = "transparent"
                      }
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: "14px", color: "#475569", marginBottom: "4px" }}>
                        {chat.title || "Nuova Conversazione"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>{formattedDate}</div>
                    </div>
                    <button
                      onClick={(e) => deleteChat(chatId, e)}
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
                padding: "16px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
                minHeight: "150px",
              }}
            >
              <h3
                style={{
                  fontFamily: "Montserrat, sans-serif",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "16px",
                  padding: "0 4px",
                }}
              >
                AGENTI AI:
              </h3>
              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                <Link
                  href="/tony-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png"
                      alt="Tony"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Tony AI</span>
                </Link>
                <Link
                  href="/aladino-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                      alt="Aladino"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Aladino AI</span>
                </Link>
                <Link
                  href="/lara-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                      alt="Lara"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Lara AI</span>
                </Link>
                <Link
                  href="/simone-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png"
                      alt="Simone"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Simone AI</span>
                </Link>
                <Link
                  href="/"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png"
                      alt="Mike"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Mike AI</span>
                </Link>
                <Link
                  href="/valentina-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                      alt="Valentina"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Valentina AI</span>
                </Link>
                <Link
                  href="/niko-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png"
                      alt="Niko"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Niko AI</span>
                </Link>
                <Link
                  href="/daniele-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                      alt="Daniele"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Daniele AI</span>
                </Link>
                <Link
                  href="/alex-ai"
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
                      overflow: "hidden",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png"
                      alt="Alex"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Alex AI</span>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Container */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#ffffff" }}>
          {/* Chat Header */}
          <div
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
            className="chat-header-responsive"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="hamburger-menu"
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
                  width: "40px",
                  height: "40px",
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
              <button
                onClick={() => setSidebarVisible(!sidebarVisible)}
                className="desktop-toggle"
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
                }}
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
                style={{ fontFamily: "Montserrat, sans-serif", fontSize: "20px", fontWeight: 600 }}
                className="header-title-responsive"
              >
                Jim AI - Coach di Vendite
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <Link
                href="/"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  background: "rgba(255,255,255,0.1)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  color: "#ffffff",
                  transition: "all 0.2s ease",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
              >
                <Home size={20} />
              </Link>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "2px solid rgba(255,255,255,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
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

          {/* Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "50px 80px",
              background: "#ffffff",
            }}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  marginBottom: "32px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "20px",
                  flexDirection: message.sender === "user" ? "row-reverse" : "row",
                  marginLeft: message.sender === "user" ? "auto" : "0",
                  maxWidth: "90%",
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
                    flexShrink: 0,
                    overflow: "hidden",
                    background:
                      message.sender === "ai" ? "linear-gradient(135deg, #235E84 0%, #235E84 100%)" : "#E3F2FD",
                    color: message.sender === "ai" ? "#ffffff" : "#235E84",
                  }}
                >
                  <img
                    src={
                      message.sender === "ai"
                        ? "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png"
                        : "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                    }
                    alt={message.sender === "ai" ? "Jim AI" : "User"}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
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
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          background: "#64748b",
                          borderRadius: "50%",
                          animation: "typing 1.4s infinite ease-in-out",
                        }}
                      />
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          background: "#64748b",
                          borderRadius: "50%",
                          animation: "typing 1.4s infinite ease-in-out",
                          animationDelay: "0.2s",
                        }}
                      />
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          background: "#64748b",
                          borderRadius: "50%",
                          animation: "typing 1.4s infinite ease-in-out",
                          animationDelay: "0.4s",
                        }}
                      />
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          color: message.sender === "user" ? "#ffffff" : "#334155",
                          lineHeight: "1.6",
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
          <div style={{ padding: "30px 80px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "12px",
                background: "#ffffff",
                border: "2px solid #e2e8f0",
                borderRadius: "12px",
                padding: "12px 16px",
              }}
            >
              <textarea
                ref={chatInputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi la tua domanda per Jim..."
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
                disabled={!inputValue.trim() || isLoading}
                style={{
                  background: !inputValue.trim() || isLoading ? "#f8fafc" : "#235E84",
                  border: "none",
                  color: !inputValue.trim() || isLoading ? "#64748b" : "#ffffff",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  cursor: !inputValue.trim() || isLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
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

      <style jsx>{`
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

        /* Mobile devices (phones) */
        @media (max-width: 768px) {
          .sidebar-responsive {
            position: fixed !important;
            left: ${sidebarVisible ? "0" : "-320px"} !important;
            top: 0 !important;
            bottom: 0 !important;
            width: 320px !important;
            min-width: 320px !important;
            box-shadow: ${sidebarVisible ? "2px 0 8px rgba(0,0,0,0.1)" : "none"} !important;
            z-index: 50 !important;
          }

          .mobile-close-btn {
            display: flex !important;
          }

          .hamburger-menu {
            display: flex !important;
          }

          .desktop-toggle {
            display: none !important;
          }

          .chat-header-responsive {
            padding: 16px 20px !important;
            min-height: 64px !important;
          }

          .header-title-responsive {
            font-size: 16px !important;
          }

          div[style*="padding: 50px 80px"] {
            padding: 20px 16px !important;
          }

          div[style*="padding: 30px 80px"] {
            padding: 16px !important;
          }

          div[style*="maxWidth: '90%'"] {
            max-width: 100% !important;
          }
        }

        /* Small mobile devices */
        @media (max-width: 480px) {
          .sidebar-responsive {
            width: 280px !important;
            min-width: 280px !important;
            left: ${sidebarVisible ? "0" : "-280px"} !important;
          }

          .header-title-responsive {
            font-size: 14px !important;
          }

          div[style*="padding: 20px"] {
            padding: 16px !important;
          }
        }

        /* Extra small devices */
        @media (max-width: 360px) {
          .sidebar-responsive {
            width: 260px !important;
            min-width: 260px !important;
            left: ${sidebarVisible ? "0" : "-260px"} !important;
          }
        }

        /* Tablet landscape */
        @media (min-width: 769px) and (max-width: 1024px) {
          div[style*="padding: 50px 80px"] {
            padding: 32px 40px !important;
          }

          div[style*="padding: 30px 80px"] {
            padding: 24px 40px !important;
          }
        }
      `}</style>
    </>
  )
}
