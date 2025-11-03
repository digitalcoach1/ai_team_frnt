"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Home, Menu, X, Plus, Trash2 } from "lucide-react"
import Link from "next/link"

const N8N_ENDPOINT =
  "https://n8n-c2lq.onrender.com/webhook/bdc4cf07-48f7-4144-ac75-659ab5197b2b/chat?action=sendMessage"

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

export default function JimAIPage() {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<Chats>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const savedChats = localStorage.getItem("jim-ai-chats")
    const savedSidebarVisible = localStorage.getItem("jim-ai-sidebar-visible")

    if (savedChats) {
      setChats(JSON.parse(savedChats))
    }

    if (savedSidebarVisible !== null) {
      setSidebarVisible(savedSidebarVisible !== "false")
    }

    setMessages([
      {
        text: "Ciao! Sono Jim AI, il tuo Sales Coach per moltiplicare le vendite con allenamenti mirati e pratici. Come posso supportarti oggi?",
        sender: "ai",
        time: "Ora",
      },
    ])
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const toggleSidebar = () => {
    const newValue = !sidebarVisible
    setSidebarVisible(newValue)
    localStorage.setItem("jim-ai-sidebar-visible", String(newValue))
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    setMessages([
      {
        text: "Ciao! Sono Jim AI, il tuo Sales Coach per moltiplicare le vendite con allenamenti mirati e pratici. Come posso supportarti oggi?",
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

    const newChats = { ...chats }
    delete newChats[chatId]
    setChats(newChats)
    localStorage.setItem("jim-ai-chats", JSON.stringify(newChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(newChats)
      if (remaining.length) {
        loadChat(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

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

    const newChats = {
      ...chats,
      [currentChatId]: {
        messages,
        lastUpdated: new Date().toISOString(),
        title: finalTitle,
      },
    }

    setChats(newChats)
    localStorage.setItem("jim-ai-chats", JSON.stringify(newChats))
  }

  const sendMessage = async () => {
    const message = inputValue.trim()
    if (!message || isStreaming) return

    setIsStreaming(true)
    const userMessage: Message = {
      text: message,
      sender: "user",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    setMessages((prev) => [...prev, userMessage])
    setInputValue("")

    const thinkingMessage: Message = {
      text: "...",
      sender: "ai",
      time: "",
    }
    setMessages((prev) => [...prev, thinkingMessage])

    try {
      const sessionId = localStorage.getItem("jim-ai-session-id") || Math.random().toString(36).slice(2, 11)
      localStorage.setItem("jim-ai-session-id", sessionId)

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
          metadata: { source: "jim-ai-chat" },
        }),
      })

      if (!res.ok) throw new Error("HTTP error " + res.status)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""
      let streamMode: "sse" | "jsonl" | null = null
      let isFirstChunk = true
      let generatedTitle: string | undefined

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
      }

      if (!rawText) {
        rawText = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
      }

      setMessages((prev) => {
        const newMessages = [...prev]
        newMessages[newMessages.length - 1] = {
          text: rawText,
          sender: "ai",
          time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        }
        return newMessages
      })

      setTimeout(() => saveChat(generatedTitle), 100)

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
            const newMessages = [...prev]
            newMessages[newMessages.length - 1] = {
              text: rawText,
              sender: "ai",
              time: "",
            }
            return newMessages
          })
        } else if (obj.type === "end" && obj.title) {
          generatedTitle = obj.title
        }
      }
    } catch (err) {
      console.error("Error with streaming request:", err)
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
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatMessageText = (text: string) => {
    if (text === "...") {
      return (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
        </div>
      )
    }

    return text.split("\n").map((line, i) => (
      <span key={i}>
        {line}
        {i < text.split("\n").length - 1 && <br />}
      </span>
    ))
  }

  const sortedChats = Object.entries(chats)
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 10)

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Sidebar */}
      <div
        className={`flex flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
          sidebarVisible ? "w-80" : "w-0"
        } overflow-hidden`}
      >
        <div className="border-b border-gray-200 p-5">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#235E84]">
                <img
                  src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png"
                  alt="Jim AI"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    e.currentTarget.parentElement!.innerHTML = "M"
                  }}
                />
              </div>
              <div className="text-xl font-semibold text-gray-700">Jim AI</div>
            </div>
          </div>
          <button
            onClick={createNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#235E84] px-5 py-3.5 text-sm font-medium text-white transition-all hover:bg-[#1a4a66]"
          >
            <Plus className="h-4 w-4" />
            Nuova Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sortedChats.map(([id, chat]) => (
            <div
              key={id}
              onClick={() => loadChat(id)}
              className={`group relative flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-blue-50 ${
                id === currentChatId ? "bg-blue-100" : ""
              }`}
            >
              <div className="flex-1">
                <div className="mb-1 text-sm font-medium text-gray-700">{chat.title}</div>
                <div className="text-xs text-gray-500">{new Date(chat.lastUpdated).toLocaleDateString("it-IT")}</div>
              </div>
              <button
                onClick={(e) => deleteChat(id, e)}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                <Trash2 className="h-4 w-4 text-red-500 hover:text-red-600" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 bg-[#235E84] px-10 py-5 text-white">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2.5 transition-colors hover:bg-white/20"
            >
              {sidebarVisible ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <Link
              href="/dashboard"
              className="flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2.5 transition-colors hover:bg-white/20"
              title="Torna alla dashboard"
            >
              <Home className="h-5 w-5" />
            </Link>
            <div className="text-xl font-semibold">Jim AI - Digital Sales Coach</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-20 py-12">
          {messages.map((msg, idx) => (
            <div key={idx} className={`mb-8 flex items-start gap-5 ${msg.sender === "user" ? "flex-row-reverse" : ""}`}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#235E84]">
                {msg.sender === "ai" ? (
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png"
                    alt="Jim AI"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      e.currentTarget.parentElement!.innerHTML = "M"
                    }}
                  />
                ) : (
                  <img
                    src="https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                    alt="User"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      e.currentTarget.parentElement!.innerHTML = "U"
                    }}
                  />
                )}
              </div>

              <div className="flex-1">
                <div
                  className={`rounded-xl border px-6 py-5 ${
                    msg.sender === "user"
                      ? "border-[#235E84] bg-[#235E84] text-white"
                      : "border-gray-200 bg-white text-black"
                  }`}
                >
                  <div className="text-[15px] leading-relaxed">{formatMessageText(msg.text)}</div>
                  {msg.time && (
                    <div className={`mt-2 text-xs ${msg.sender === "user" ? "text-white/70" : "text-gray-500"}`}>
                      {msg.time}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 px-20 py-8">
          <div className="flex items-end gap-3 rounded-xl border-2 border-gray-200 bg-white px-4 py-3 transition-all focus-within:border-[#235E84] focus-within:shadow-lg">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua domanda per Jim..."
              className="max-h-32 min-h-6 flex-1 resize-none border-none bg-transparent text-[15px] text-black outline-none placeholder:text-gray-400"
              rows={1}
              disabled={isStreaming}
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isStreaming}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#235E84] text-white transition-all hover:scale-105 disabled:cursor-not-allowed disabled:bg-gray-300"
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
