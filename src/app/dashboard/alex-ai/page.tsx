"use client"

import type React from "react"
import Link from "next/link"
import { useState, useEffect, useRef } from "react"

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

export default function AlexAIPage() {
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<Chats>({})
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/65c03f65-d13c-43c7-967d-708dcceef965/chat?action=sendMessage"

  useEffect(() => {
    const savedChats = localStorage.getItem("alex-ai-chats")
    const savedSidebar = localStorage.getItem("alex-ai-sidebar-visible")

    if (savedChats) {
      setChats(JSON.parse(savedChats))
    }
    if (savedSidebar !== null) {
      setSidebarVisible(savedSidebar !== "false")
    }
  }, [])

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [chats, currentChatId])

  const currentChat = chats[currentChatId] || {
    messages: [
      {
        text: "Ciao! Sono Alex AI, il tuo Cross-Platform Ads Strategist di livello mondiale specializzato nella creazione e ottimizzazione di campagne pubblicitarie integrate. Come posso supportarti oggi?",
        sender: "ai" as const,
        time: "Ora",
      },
    ],
    lastUpdated: new Date().toISOString(),
    title: "Nuova Conversazione",
  }

  const toggleSidebar = () => {
    const newState = !sidebarVisible
    setSidebarVisible(newState)
    localStorage.setItem("alex-ai-sidebar-visible", String(newState))
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    setChats((prev) => ({
      ...prev,
      [newChatId]: {
        messages: [
          {
            text: "Ciao! Sono Alex AI, il tuo Cross-Platform Ads Strategist. Come posso aiutarti oggi?",
            sender: "ai",
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
          },
        ],
        lastUpdated: new Date().toISOString(),
        title: "Nuova Conversazione",
      },
    }))
  }

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId)
  }

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Sei sicuro di voler eliminare questa conversazione?")) return

    const newChats = { ...chats }
    delete newChats[chatId]
    setChats(newChats)
    localStorage.setItem("alex-ai-chats", JSON.stringify(newChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(newChats)
      if (remaining.length) {
        setCurrentChatId(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

  const sendMessage = async () => {
    const message = inputValue.trim()
    if (!message || isLoading) return

    setIsLoading(true)
    const userMessage: Message = {
      text: message,
      sender: "user",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }

    const updatedMessages = [...currentChat.messages, userMessage]
    const updatedChats = {
      ...chats,
      [currentChatId]: {
        ...currentChat,
        messages: updatedMessages,
        lastUpdated: new Date().toISOString(),
      },
    }
    setChats(updatedChats)
    setInputValue("")

    const thinkingMessage: Message = {
      text: "...",
      sender: "ai",
      time: "",
    }
    setChats((prev) => ({
      ...prev,
      [currentChatId]: {
        ...prev[currentChatId],
        messages: [...prev[currentChatId].messages, thinkingMessage],
      },
    }))

    try {
      const sessionId = localStorage.getItem("alex-ai-session-id") || Math.random().toString(36).slice(2, 11)
      localStorage.setItem("alex-ai-session-id", sessionId)

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
          metadata: { source: "alex-ai-chat" },
        }),
      })

      if (!res.ok) throw new Error("HTTP error " + res.status)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""

      if (reader) {
        while (true) {
          const { value, done } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue

            try {
              const obj = JSON.parse(trimmed.replace(/^data:\s?/, ""))
              if (obj.type === "item" && typeof obj.content === "string") {
                rawText += obj.content

                setChats((prev) => {
                  const messages = [...prev[currentChatId].messages]
                  messages[messages.length - 1] = {
                    text: rawText,
                    sender: "ai",
                    time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
                  }
                  return {
                    ...prev,
                    [currentChatId]: {
                      ...prev[currentChatId],
                      messages,
                      lastUpdated: new Date().toISOString(),
                    },
                  }
                })
              }
            } catch {}
          }
        }
      }

      const finalChats = { ...chats }
      if (finalChats[currentChatId]) {
        const userMessages = finalChats[currentChatId].messages.filter((m) => m.sender === "user")
        if (userMessages.length >= 2) {
          finalChats[currentChatId].title = userMessages[1].text.substring(0, 40) + "..."
        } else if (userMessages.length === 1) {
          finalChats[currentChatId].title = userMessages[0].text.substring(0, 40) + "..."
        }
      }
      localStorage.setItem("alex-ai-chats", JSON.stringify(finalChats))
    } catch (err) {
      console.error("[v0] Error with streaming request:", err)
      setChats((prev) => {
        const messages = [...prev[currentChatId].messages]
        messages[messages.length - 1] = {
          text: "Errore di connessione. Riprova più tardi.",
          sender: "ai",
          time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        }
        return {
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            messages,
          },
        }
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

  const chatItems = Object.entries(chats)
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 10)

  return (
    <div className="w-full h-screen overflow-hidden bg-white border-4 border-[#235E84] flex">
      {/* Sidebar */}
      <div
        className={`${sidebarVisible ? "w-80" : "w-0"} transition-all duration-300 overflow-hidden bg-white border-r border-gray-200 flex flex-col`}
      >
        <div className="p-5 border-b border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#235E84] flex items-center justify-center text-white font-semibold">
                AA
              </div>
              <div className="font-semibold text-lg">Alex AI</div>
            </div>
          </div>
          <button
            onClick={createNewChat}
            className="w-full bg-[#235E84] text-white py-3 px-5 rounded-lg font-medium hover:bg-[#1a4a66] transition-all flex items-center justify-center gap-2"
          >
            <span>+</span> Nuova Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chatItems.map(([id, chat]) => (
            <div
              key={id}
              onClick={() => loadChat(id)}
              className={`p-4 cursor-pointer hover:bg-blue-50 transition-all flex justify-between items-center ${
                id === currentChatId ? "bg-blue-100" : ""
              }`}
            >
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-800">{chat.title}</div>
                <div className="text-xs text-gray-500">{new Date(chat.lastUpdated).toLocaleDateString("it-IT")}</div>
              </div>
              <button
                onClick={(e) => deleteChat(id, e)}
                className="opacity-0 hover:opacity-100 bg-red-500 text-white w-6 h-6 rounded flex items-center justify-center text-xs hover:bg-red-600 transition-all"
              >
                🗑
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-[#235E84] text-white py-5 px-10 flex items-center justify-between min-h-[80px]">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="bg-white/10 border border-white/20 p-2 rounded-lg hover:bg-white/20 transition-all"
              title="Torna alla dashboard"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
            </Link>
            <button
              onClick={toggleSidebar}
              className="bg-white/10 border border-white/20 p-2 rounded-lg hover:bg-white/20 transition-all"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                {sidebarVisible ? (
                  <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                ) : (
                  <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                )}
              </svg>
            </button>
            <div className="font-semibold text-xl">Alex AI - ADs Manager</div>
          </div>
        </div>

        {/* Messages */}
        <div ref={chatMessagesRef} className="flex-1 overflow-y-auto py-12 px-20 bg-white">
          {currentChat.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-8 flex items-start gap-5 ${
                msg.sender === "user" ? "flex-row-reverse ml-auto" : ""
              } max-w-[90%]`}
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0 ${
                  msg.sender === "ai"
                    ? "bg-gradient-to-br from-[#235E84] to-[#1a4a66] text-white"
                    : "bg-blue-100 text-[#235E84]"
                }`}
              >
                {msg.sender === "ai" ? "AA" : "U"}
              </div>
              <div
                className={`flex-1 p-5 rounded-xl ${
                  msg.sender === "user" ? "bg-[#235E84] text-white" : "bg-white border border-gray-200"
                }`}
              >
                <div
                  className={`leading-relaxed text-[15px] whitespace-pre-wrap ${msg.sender === "ai" ? "text-black" : ""}`}
                >
                  {msg.text === "..." ? (
                    <div className="flex gap-1">
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  ) : (
                    msg.text
                  )}
                </div>
                {msg.time && (
                  <div className={`text-xs mt-2 ${msg.sender === "user" ? "text-white/70" : "text-gray-500"}`}>
                    {msg.time}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="py-8 px-20 border-t border-gray-200 bg-white">
          <div className="flex items-end gap-3 bg-white border-2 border-gray-200 rounded-xl p-3 focus-within:border-[#235E84] transition-all">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua domanda per Alex..."
              className="flex-1 border-none outline-none bg-transparent text-[15px] text-black resize-none min-h-[24px] max-h-[120px]"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="bg-[#235E84] text-white w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#1a4a66] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all flex-shrink-0"
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
