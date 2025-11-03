"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Home, Menu, X, Send } from "lucide-react"
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

const N8N_ENDPOINT =
  "https://n8n-c2lq.onrender.com/webhook/b53858eb-1e73-4798-80ae-13c0d3323f1a/chat?action=sendMessage"

export default function DanieleAIPage() {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<Chats>({})
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const savedChats = localStorage.getItem("daniele-ai-chats")
    const savedSidebarVisible = localStorage.getItem("daniele-ai-sidebar-visible")

    if (savedChats) {
      setChats(JSON.parse(savedChats))
    }
    if (savedSidebarVisible !== null) {
      setSidebarVisible(savedSidebarVisible !== "false")
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chats, currentChatId])

  const currentChat = chats[currentChatId] || {
    messages: [
      {
        text: "Ciao! Sono Daniele AI, il tuo direct response copywriter di livello mondiale con oltre 30 anni di esperienza nel settore. Come posso supportarti oggi?",
        sender: "ai" as const,
        time: "Ora",
      },
    ],
    lastUpdated: new Date().toISOString(),
    title: "Nuova Conversazione",
  }

  const toggleSidebar = () => {
    const newValue = !sidebarVisible
    setSidebarVisible(newValue)
    localStorage.setItem("daniele-ai-sidebar-visible", String(newValue))
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    const newChats = {
      ...chats,
      [newChatId]: {
        messages: [
          {
            text: "Ciao! Sono Daniele AI, il tuo direct response copywriter di livello mondiale con oltre 30 anni di esperienza nel settore. Come posso supportarti oggi?",
            sender: "ai" as const,
            time: "Ora",
          },
        ],
        lastUpdated: new Date().toISOString(),
        title: "Nuova Conversazione",
      },
    }
    setChats(newChats)
    localStorage.setItem("daniele-ai-chats", JSON.stringify(newChats))
  }

  const deleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Sei sicuro di voler eliminare questa conversazione?")) return

    const newChats = { ...chats }
    delete newChats[chatId]
    setChats(newChats)
    localStorage.setItem("daniele-ai-chats", JSON.stringify(newChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(newChats)
      if (remaining.length) {
        setCurrentChatId(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

  const loadChat = (chatId: string) => {
    setCurrentChatId(chatId)
  }

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      text: inputValue,
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
    setIsLoading(true)

    const thinkingMessage: Message = {
      text: "...",
      sender: "ai",
      time: "",
    }
    const messagesWithThinking = [...updatedMessages, thinkingMessage]
    setChats({
      ...updatedChats,
      [currentChatId]: {
        ...updatedChats[currentChatId],
        messages: messagesWithThinking,
      },
    })

    try {
      const sessionId = localStorage.getItem("daniele-ai-session-id") || Math.random().toString(36).slice(2, 11)
      localStorage.setItem("daniele-ai-session-id", sessionId)

      const res = await fetch(N8N_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          action: "sendMessage",
          chatInput: userMessage.text,
          sessionId,
          metadata: { source: "daniele-ai-chat" },
        }),
      })

      if (!res.ok) throw new Error("HTTP error " + res.status)

      const reader = res.body?.getReader()
      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""
      let streamMode: "sse" | "jsonl" | null = null

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

      function handleEvent(jsonStr: string) {
        let obj
        try {
          obj = JSON.parse(jsonStr)
        } catch {
          return
        }

        if (obj.type === "item" && typeof obj.content === "string") {
          rawText += obj.content
          const aiMessage: Message = {
            text: rawText,
            sender: "ai",
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
          }
          const finalMessages = [...updatedMessages, aiMessage]
          setChats((prev) => ({
            ...prev,
            [currentChatId]: {
              ...prev[currentChatId],
              messages: finalMessages,
              lastUpdated: new Date().toISOString(),
            },
          }))
        }
      }

      const userMessages = updatedMessages.filter((m) => m.sender === "user")
      let finalTitle = "Nuova Conversazione"
      if (userMessages.length >= 2) {
        finalTitle = userMessages[1].text.substring(0, 40) + "..."
      } else if (userMessages.length === 1) {
        finalTitle = userMessages[0].text.substring(0, 40) + "..."
      }

      setChats((prev) => {
        const updated = {
          ...prev,
          [currentChatId]: {
            ...prev[currentChatId],
            title: finalTitle,
          },
        }
        localStorage.setItem("daniele-ai-chats", JSON.stringify(updated))
        return updated
      })
    } catch (err) {
      console.error("Error with streaming request:", err)
      const errorMessage: Message = {
        text: "Errore di connessione. Riprova più tardi.",
        sender: "ai",
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      }
      setChats((prev) => ({
        ...prev,
        [currentChatId]: {
          ...prev[currentChatId],
          messages: [...updatedMessages, errorMessage],
        },
      }))
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
                <span className="text-sm font-semibold text-white">DA</span>
              </div>
              <div className="text-xl font-semibold text-gray-700">Daniele AI</div>
            </div>
          </div>
          <button
            onClick={createNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#235E84] px-5 py-3.5 text-sm font-medium text-white transition-all hover:bg-[#1a4a66]"
          >
            <span>+</span> Nuova Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chatItems.map(([id, chat]) => (
            <div
              key={id}
              onClick={() => loadChat(id)}
              className={`mb-0.5 flex cursor-pointer items-center justify-between rounded-lg p-4 transition-all ${
                id === currentChatId ? "bg-blue-50 text-[#235E84]" : "hover:bg-blue-50"
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
        <div className="flex min-h-[80px] items-center justify-between border-b border-gray-200 bg-[#235E84] px-10 py-5">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-all hover:bg-white/20"
            >
              <Home className="h-5 w-5" />
            </Link>
            <button
              onClick={toggleSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-white transition-all hover:bg-white/20"
            >
              {sidebarVisible ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <div className="text-xl font-semibold text-white">Daniele AI - Specialista per Landing Page e Funnel</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white px-20 py-12">
          {currentChat.messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-8 flex items-start gap-5 ${
                msg.sender === "user" ? "ml-auto flex-row-reverse" : ""
              } max-w-[90%]`}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full ${
                  msg.sender === "ai"
                    ? "bg-gradient-to-br from-[#235E84] to-[#1a4a66] text-white"
                    : "bg-blue-50 text-[#235E84]"
                }`}
              >
                <span className="text-sm font-semibold">{msg.sender === "ai" ? "DA" : "U"}</span>
              </div>
              <div className="flex-1">
                <div
                  className={`rounded-xl border p-6 ${
                    msg.sender === "user"
                      ? "border-[#235E84] bg-[#235E84] text-white"
                      : "border-gray-200 bg-white text-black"
                  }`}
                >
                  <div className="text-[15px] leading-relaxed">
                    {msg.text === "..." ? (
                      <div className="flex gap-1">
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
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white px-20 py-8">
          <div className="flex items-end gap-3 rounded-xl border-2 border-gray-200 bg-white p-3 transition-all focus-within:border-[#235E84] focus-within:shadow-lg">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua domanda per Daniele..."
              className="max-h-[120px] min-h-[24px] flex-1 resize-none border-none bg-transparent text-[15px] text-black outline-none placeholder:text-gray-400"
              rows={1}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#235E84] text-white transition-all hover:scale-105 hover:bg-[#1a4a66] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
