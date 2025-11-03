"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Home, Menu, X } from "lucide-react"
import Link from "next/link"

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

interface Chats {
  [key: string]: Chat
}

export default function LaraAIPage() {
  const [message, setMessage] = useState("")
  const [messages, setMessages] = useState<Message[]>([
    {
      text: "Ciao, sono Lara AI, un Social Media Manager virtuale, perfetta per gestire e automatizzare la creazione dei tuoi contenuti sui social media. Come posso supportarti oggi?",
      sender: "ai",
      time: "Ora",
    },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [chats, setChats] = useState<Chats>({})
  const [currentChatId, setCurrentChatId] = useState("default")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/59483f3b-8c59-4381-b94b-9c80a69b8196/chat?action=sendMessage"

  useEffect(() => {
    const savedChats = localStorage.getItem("lara-ai-chats")
    const savedSidebarVisible = localStorage.getItem("lara-ai-sidebar-visible")

    if (savedChats) {
      setChats(JSON.parse(savedChats))
    }
    if (savedSidebarVisible !== null) {
      setSidebarVisible(savedSidebarVisible !== "false")
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const saveChat = (generatedTitle?: string) => {
    if (messages.length <= 1) return

    const userMessages = messages.filter((m) => m.sender === "user")
    let finalTitle = "Nuova Conversazione"

    if (generatedTitle) {
      finalTitle = generatedTitle
    } else if (userMessages.length >= 2) {
      finalTitle = userMessages[1].text.substring(0, 40) + "..."
    } else if (userMessages.length === 1) {
      finalTitle = userMessages[0].text.substring(0, 40) + "..."
    }

    const updatedChats = {
      ...chats,
      [currentChatId]: {
        messages,
        lastUpdated: new Date().toISOString(),
        title: finalTitle,
      },
    }

    setChats(updatedChats)
    localStorage.setItem("lara-ai-chats", JSON.stringify(updatedChats))
  }

  const handleSend = async () => {
    if (!message.trim() || isLoading) return

    const userMessage: Message = {
      text: message,
      sender: "user",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setMessage("")
    setIsLoading(true)

    const thinkingMessage: Message = {
      text: "...",
      sender: "ai",
      time: "",
    }
    setMessages((prev) => [...prev, thinkingMessage])

    try {
      const sessionId = localStorage.getItem("lara-ai-session-id") || generateSessionId()
      localStorage.setItem("lara-ai-session-id", sessionId)

      const res = await fetch(N8N_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          action: "sendMessage",
          chatInput: message,
          sessionId,
          metadata: { source: "lara-ai-chat" },
        }),
      })

      if (!res.ok) throw new Error("HTTP error " + res.status)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""
      let streamMode: "sse" | "jsonl" | null = null
      let isFirstChunk = true
      let generatedTitle: string | null = null

      if (!reader) throw new Error("No reader available")

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
            if (dataLines.length === 0) continue
            const jsonStr = dataLines
              .map((l) => l.replace(/^data:\s?/, ""))
              .join("\n")
              .trim()
            handleEvent(jsonStr)
          }
        } else {
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            handleEvent(trimmed)
          }
        }
      }

      const leftover = buffer.trim()
      if (leftover) {
        if (streamMode === "sse") {
          const dataLines = leftover.split("\n").filter((l) => l.startsWith("data:"))
          if (dataLines.length) handleEvent(dataLines.map((l) => l.replace(/^data:\s?/, "")).join("\n"))
        } else {
          handleEvent(leftover)
        }
      }

      setMessages((prev) => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg.sender === "ai") {
          if (!lastMsg.text || lastMsg.text === "...") {
            lastMsg.text = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
          }
          lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        }
        return updated
      })

      saveChat(generatedTitle || undefined)

      function handleEvent(jsonStr: string) {
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
            if (lastMsg.sender === "ai") {
              lastMsg.text = rawText
            }
            return updated
          })
        } else if (obj.type === "end" && obj.title) {
          generatedTitle = obj.title
        }
      }
    } catch (err) {
      console.error("Error with streaming request:", err)
      setMessages((prev) => {
        const updated = [...prev]
        const lastMsg = updated[updated.length - 1]
        if (lastMsg.sender === "ai") {
          lastMsg.text = "Errore di connessione. Riprova più tardi."
          lastMsg.time = new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })
        }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createNewChat = () => {
    setCurrentChatId("chat_" + Date.now())
    setMessages([
      {
        text: "Ciao, sono Lara AI, un Social Media Manager virtuale, perfetta per gestire e automatizzare la creazione dei tuoi contenuti sui social media. Come posso supportarti oggi?",
        sender: "ai",
        time: "Ora",
      },
    ])
  }

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId)
    const chat = chats[chatId]
    if (chat) {
      setMessages(chat.messages)
    }
  }

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Sei sicuro di voler eliminare questa conversazione?")) return

    const updatedChats = { ...chats }
    delete updatedChats[chatId]
    setChats(updatedChats)
    localStorage.setItem("lara-ai-chats", JSON.stringify(updatedChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(updatedChats)
      if (remaining.length) {
        loadChat(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

  const generateSessionId = () => {
    return Math.random().toString(36).slice(2, 11)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const chatItems = Object.entries(chats)
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 10)

  return (
    <div
      className="flex h-screen overflow-hidden bg-white"
      style={{ fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
    >
      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
          sidebarVisible ? "w-80" : "w-0"
        } overflow-hidden`}
      >
        <div className="border-b border-gray-200 p-5">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full"
                style={{ background: "#235E84" }}
              >
                <img
                  src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                  alt="Lara AI"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    e.currentTarget.parentElement!.innerHTML = "L"
                  }}
                />
              </div>
              <div className="text-xl font-semibold text-gray-700" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                Lara AI
              </div>
            </div>
          </div>
          <button
            onClick={createNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3.5 text-sm font-medium text-white transition-all hover:-translate-y-0.5"
            style={{ background: "#235E84" }}
          >
            <span>+</span> Nuova Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chatItems.map(([id, chat]) => (
            <div
              key={id}
              onClick={() => loadChat(id)}
              className={`relative mb-0.5 flex cursor-pointer items-center justify-between rounded-lg p-4 transition-all ${
                id === currentChatId ? "bg-blue-50" : "hover:bg-blue-50"
              }`}
            >
              <div className="flex-1">
                <div className="mb-1 text-sm font-medium text-gray-700">{chat.title}</div>
                <div className="text-xs text-gray-500">{new Date(chat.lastUpdated).toLocaleDateString("it-IT")}</div>
              </div>
              <button
                onClick={(e) => deleteChat(id, e)}
                className="flex h-6 w-6 items-center justify-center rounded bg-red-500 text-xs text-white opacity-0 transition-all hover:bg-red-600 group-hover:opacity-100"
                title="Elimina conversazione"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div
          className="flex min-h-[80px] items-center justify-between border-b border-gray-200 px-10 py-5"
          style={{ background: "#235E84" }}
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => {
                setSidebarVisible(!sidebarVisible)
                localStorage.setItem("lara-ai-sidebar-visible", String(!sidebarVisible))
              }}
              className="flex items-center justify-center rounded-lg border border-white/20 p-2.5 text-white transition-all hover:bg-white/20"
            >
              {sidebarVisible ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link
              href="/"
              className="flex items-center justify-center rounded-lg border border-white/20 p-2.5 text-white transition-all hover:bg-white/20"
              title="Torna alla dashboard"
            >
              <Home className="h-5 w-5" />
            </Link>
            <div className="text-xl font-semibold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
              Lara AI - Social Media Manager
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white px-20 py-12">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-8 flex items-start gap-5 ${msg.sender === "user" ? "ml-auto flex-row-reverse" : ""} max-w-[90%]`}
            >
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
                style={{
                  background: msg.sender === "ai" ? "linear-gradient(135deg, #235E84 0%, #235E84 100%)" : "#E3F2FD",
                }}
              >
                {msg.sender === "ai" ? (
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                    alt="Lara AI"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      e.currentTarget.parentElement!.innerHTML = "L"
                    }}
                  />
                ) : (
                  <span className="font-semibold text-sm" style={{ color: "#235E84" }}>
                    U
                  </span>
                )}
              </div>
              <div
                className={`flex-1 rounded-xl border px-6 py-5 shadow-sm ${msg.sender === "user" ? "border-[#235E84]" : "border-gray-200"}`}
                style={{ background: msg.sender === "user" ? "#235E84" : "#ffffff" }}
              >
                <div className={`text-[15px] leading-relaxed ${msg.sender === "user" ? "text-white" : "text-black"}`}>
                  {msg.text === "..." ? (
                    <div className="flex items-center gap-1.5">
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "0s" }}
                      ></div>
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
                {msg.time && (
                  <div className={`mt-2 text-xs ${msg.sender === "user" ? "text-white/70" : "text-gray-500"}`}>
                    {msg.time}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-20 py-7">
          <div className="flex items-end gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all focus-within:border-[#235E84] focus-within:shadow-[0_0_0_3px_rgba(35,94,132,0.1)]">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua domanda per Lara..."
              className="max-h-[120px] min-h-[24px] flex-1 resize-none border-none bg-transparent text-[15px] text-gray-700 outline-none placeholder:text-gray-400"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim() || isLoading}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-white transition-all hover:scale-105 disabled:cursor-not-allowed disabled:bg-gray-300"
              style={{ background: message.trim() && !isLoading ? "#235E84" : undefined }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
