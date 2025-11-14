"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { Home, Menu, X } from 'lucide-react'

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

export default function ValentinaAI() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [useMemory, setUseMemory] = useState(true)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<Record<string, Chat>>({})

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const CURRENT_NAMESPACE = useRef<string>("")

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/f5636e0e-1355-439b-b5fd-df0174e3dddb/chat?action=sendMessage"

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

    const savedMemory = localStorage.getItem("valentina-ai-use-memory")
    if (savedMemory !== null) {
      setUseMemory(savedMemory !== "false")
    }

    const savedSidebarVisible = localStorage.getItem("valentina-ai-sidebar-visible")
    if (savedSidebarVisible !== null) {
      setSidebarVisible(savedSidebarVisible !== "false")
    }

    const savedChats = localStorage.getItem("valentina-ai-chats")
    if (savedChats) {
      const parsedChats = JSON.parse(savedChats) as Record<string, Chat>
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
  }, [])

  const createInitialMessage = () => {
    const initialMsg: Message = {
      text: "Ciao, sono Valentina AI. la tua esperta di SEO, specializzata nell'ottimizzazione dei contenuti già pubblicati e nel posizionamento sui motori di ricerca. Come posso aiutarti oggi?",
      sender: "ai",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages([initialMsg])
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

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
    localStorage.setItem("valentina-ai-chats", JSON.stringify(updatedChats))
  }

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId)
    const chat = chats[chatId]
    if (chat) {
      setMessages(chat.messages || [])
    }
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    localStorage.setItem("valentina-ai-session-id", newChatId)
    createInitialMessage()
  }

  const deleteChat = (chatId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    if (!confirm("Sei sicuro di voler eliminare questa conversazione?")) return

    const updatedChats = { ...chats }
    delete updatedChats[chatId]
    setChats(updatedChats)
    localStorage.setItem("valentina-ai-chats", JSON.stringify(updatedChats))

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
    let formatted = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    formatted = formatted.replace(/\*(.+?)\*/g, "<em>$1</em>")
    formatted = formatted.replace(
      /`([^`]+?)`/g,
      '<code style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-family: monospace;">$1</code>',
    )
    formatted = formatted.replace(
      /\[([^\]]+?)\]\$\$(https?:\/\/[^\s)]+?)\$\$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #235E84; text-decoration: underline;">$1</a>',
    )
    formatted = formatted.replace(/\n/g, "<br>")

    return formatted
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
      const sessionId = localStorage.getItem("valentina-ai-session-id") || "session_" + Date.now()
      localStorage.setItem("valentina-ai-session-id", sessionId)

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
            source: "valentina-ai-chat",
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
        let obj: any
        try {
          obj = JSON.parse(jsonStr)
        } catch {
          return
        }

        if (obj.type === "item" && typeof obj.content === "string") {
          if (isFirstChunk) {
            isFirstChunk = false
          }
          rawText += obj.content

          setMessages((prev) => {
            const updated = [...prev]
            const lastMsg = updated[updated.length - 1]
            if (lastMsg && lastMsg.sender === "ai") {
              lastMsg.text = rawText
              lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
            }
            return updated
          })
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
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg && lastMsg.sender === "ai" && !lastMsg.text) {
          lastMsg.text = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
          lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        }
        return updated
      })

      if (generatedTitle) {
        saveChat(generatedTitle)
      }
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
        
        body {
          margin: 0;
          padding: 0;
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .valentina-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .valentina-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
        }
        .valentina-scrollbar::-webkit-scrollbar-thumb {
          background: #235E84;
          border-radius: 3px;
        }
        .valentina-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #1a4a66;
        }

        /* Added responsive styles for mobile screens */
        @media (max-width: 1024px) {
          body {
            font-size: 15px;
          }
        }

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
          background: "#ffffff",
          fontFamily: "'Open Sans', sans-serif",
          position: "relative",
        }}
      >
        {sidebarVisible && (
          <div
            onClick={() => {
              setSidebarVisible(false)
              localStorage.setItem("valentina-ai-sidebar-visible", "false")
            }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.5)",
              zIndex: 999,
              display: "none",
            }}
            className="mobile-backdrop"
          />
        )}

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
            zIndex: 1000,
          }}
          className="valentina-sidebar"
        >
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
                  }}
                >
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                    alt="Valentina AI"
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "'Montserrat', sans-serif",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "#475569",
                  }}
                  className="brand-text"
                >
                  Valentina AI
                </div>
              </div>
              <button
                onClick={() => {
                  setSidebarVisible(false)
                  localStorage.setItem("valentina-ai-sidebar-visible", "false")
                }}
                style={{
                  background: "rgba(35, 94, 132, 0.1)",
                  border: "none",
                  color: "#235E84",
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "none",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                }}
                className="mobile-close-btn"
              >
                <X size={18} />
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
              className="new-chat-btn"
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
              className="memory-toggle-container"
            >
              <label htmlFor="memoryToggle">Usa Memoria</label>
              <label style={{ position: "relative", display: "inline-block", width: "44px", height: "24px" }}>
                <input
                  type="checkbox"
                  id="memoryToggle"
                  checked={useMemory}
                  onChange={(e) => {
                    setUseMemory(e.target.checked)
                    localStorage.setItem("valentina-ai-use-memory", String(e.target.checked))
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
                      left: useMemory ? "23px" : "3px",
                      bottom: "3px",
                      background: "white",
                      transition: "0.4s",
                      borderRadius: "50%",
                    }}
                  />
                </span>
              </label>
            </div>
          </div>

          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
            <div
              className="valentina-scrollbar"
              style={{ flex: "1 1 auto", overflowY: "auto", padding: "16px 20px", minHeight: "100px" }}
            >
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
                    onClick={() => loadChat(chatId)}
                    style={{
                      padding: "16px",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s ease",
                      marginBottom: "2px",
                      background: chatId === currentChatId ? "#E3F2FD" : "transparent",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
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

            <div
              style={{
                flex: "1 1 auto",
                minHeight: "150px",
                padding: "16px 20px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <h3
                style={{
                  fontFamily: "'Montserrat', sans-serif",
                  fontSize: "16px",
                  fontWeight: 600,
                  color: "#475569",
                  marginBottom: "16px",
                  padding: "0 4px",
                }}
              >
                AGENTI AI:
              </h3>
              <div
                className="valentina-scrollbar"
                style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}
              >
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
                    }}
                  >
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                      alt="Aladino"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  </div>
                  <span style={{ fontSize: "14px", fontWeight: 500 }}>Aladdin AI</span>
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

        {/* Main Chat Area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ffffff" }}>
          {/* Header */}
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
            className="chat-header"
          >
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <button
                onClick={() => {
                  setSidebarVisible(!sidebarVisible)
                  localStorage.setItem("valentina-ai-sidebar-visible", String(!sidebarVisible))
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
                }}
                className="sidebar-toggle"
                title="Mostra/Nascondi conversazioni"
              >
                <span className="desktop-toggle">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    {sidebarVisible ? (
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    ) : (
                      <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                    )}
                  </svg>
                </span>
                <span className="mobile-toggle" style={{ display: "none" }}>
                  <Menu size={20} />
                </span>
              </button>
              <div
                style={{ fontFamily: "'Montserrat', sans-serif", fontSize: "20px", fontWeight: 600 }}
                className="header-title"
              >
                Valentina AI - SEO Optimizer
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }} className="header-actions">
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
                  transition: "all 0.2s ease",
                  color: "#ffffff",
                }}
                className="home-btn"
              >
                <Home size={20} />
              </Link>
              <div style={{ width: "40px", height: "40px" }}>
                <UserButton />
              </div>
            </div>
          </div>

          {/* Messages */}
          <div
            className="valentina-scrollbar messages-container"
            style={{ flex: 1, overflowY: "auto", padding: "50px 80px", background: "#ffffff", minHeight: 0 }}
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
                    fontWeight: 600,
                    fontSize: "14px",
                    flexShrink: 0,
                    overflow: "hidden",
                    background:
                      message.sender === "ai" ? "linear-gradient(135deg, #235E84 0%, #235E84 100%)" : "#E3F2FD",
                    color: message.sender === "ai" ? "#ffffff" : "#235E84",
                  }}
                >
                  {message.sender === "ai" ? (
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                      alt="Valentina AI"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <img
                      src="https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                      alt="User"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  )}
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
                  {message.text ? (
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
                  ) : (
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
                          animation: "typing 1.4s infinite ease-in-out 0.2s",
                        }}
                      />
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          background: "#64748b",
                          borderRadius: "50%",
                          animation: "typing 1.4s infinite ease-in-out 0.4s",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{ padding: "30px 80px", borderTop: "1px solid #e2e8f0", background: "#ffffff" }}
            className="input-container"
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
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Scrivi la tua domanda per Valentina..."
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
                disabled={isLoading || !inputValue.trim()}
                style={{
                  background: isLoading || !inputValue.trim() ? "#f8fafc" : "#235E84",
                  border: "none",
                  color: isLoading || !inputValue.trim() ? "#64748b" : "#ffffff",
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  cursor: isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.2s ease",
                  flexShrink: 0,
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

        /* Added comprehensive responsive styles */
        @media (max-width: 1024px) {
          .messages-container {
            padding: 40px 50px !important;
          }
          .input-container {
            padding: 25px 50px !important;
          }
          .chat-header {
            padding: 18px 30px !important;
            min-height: 70px !important;
          }
          .header-title {
            font-size: 18px !important;
          }
        }

        @media (max-width: 768px) {
          .valentina-sidebar {
            position: fixed !important;
            left: 0;
            top: 0;
            bottom: 0;
            z-index: 1000;
            transform: translateX(${sidebarVisible ? '0' : '-100%'});
            width: 280px !important;
            min-width: 280px !important;
          }

          .mobile-backdrop {
            display: ${sidebarVisible ? 'block' : 'none'} !important;
          }

          .mobile-close-btn {
            display: flex !important;
          }

          .desktop-toggle {
            display: none !important;
          }

          .mobile-toggle {
            display: block !important;
          }

          .messages-container {
            padding: 20px 16px !important;
          }

          .input-container {
            padding: 16px !important;
          }

          .chat-header {
            padding: 12px 16px !important;
            min-height: 60px !important;
          }

          .header-title {
            font-size: 16px !important;
            display: none !important;
          }

          .header-actions {
            gap: 12px !important;
          }

          .home-btn,
          .header-actions > div {
            width: 36px !important;
            height: 36px !important;
          }

          .brand-text {
            font-size: 18px !important;
          }

          .new-chat-btn {
            padding: 12px 16px !important;
            font-size: 13px !important;
          }

          .memory-toggle-container {
            font-size: 13px !important;
          }
        }

        @media (max-width: 480px) {
          .valentina-sidebar {
            width: 260px !important;
            min-width: 260px !important;
          }

          .messages-container {
            padding: 16px 12px !important;
          }

          .input-container {
            padding: 12px !important;
          }

          .chat-header {
            padding: 10px 12px !important;
            min-height: 56px !important;
          }

          .brand-text {
            font-size: 16px !important;
          }

          .new-chat-btn {
            padding: 10px 14px !important;
            font-size: 12px !important;
          }
        }

        @media (max-width: 360px) {
          .valentina-sidebar {
            width: 240px !important;
            min-width: 240px !important;
          }

          .messages-container {
            padding: 12px 8px !important;
          }

          .input-container {
            padding: 10px !important;
          }
        }
      `}</style>
    </>
  )
}
