"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Menu, Home, Send } from "lucide-react"
import Link from "next/link"

const N8N_ENDPOINT =
  "https://n8n-c2lq.onrender.com/webhook/da2742bb-3308-4d18-a58b-77abed489389/chat?action=sendMessage"

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

export default function SimoneAIPage() {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<Record<string, Chat>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const savedChats = localStorage.getItem("simone-ai-chats")
    const savedSidebarVisible = localStorage.getItem("simone-ai-sidebar-visible")

    if (savedChats) {
      setChats(JSON.parse(savedChats))
    }
    if (savedSidebarVisible !== null) {
      setSidebarVisible(savedSidebarVisible !== "false")
    }

    const initialMessage: Message = {
      text: "Ciao, sono Simone AI. Il tuo AI SEO Copywriter specializzato nella creazione di contenuti testuali di alta qualità che si massimizzino su Google. Come posso supportarti oggi?",
      sender: "ai",
      time: "Ora",
    }
    setMessages([initialMessage])
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

  const toggleSidebar = () => {
    const newValue = !sidebarVisible
    setSidebarVisible(newValue)
    localStorage.setItem("simone-ai-sidebar-visible", String(newValue))
  }

  const createNewChat = () => {
    const newChatId = "chat_" + Date.now()
    setCurrentChatId(newChatId)
    const initialMessage: Message = {
      text: "Ciao, sono Simone AI. Il tuo AI SEO Copywriter. Come posso aiutarti oggi?",
      sender: "ai",
      time: "Ora",
    }
    setMessages([initialMessage])
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
    localStorage.setItem("simone-ai-chats", JSON.stringify(newChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(newChats)
      if (remaining.length > 0) {
        loadChat(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

  const saveChat = (generatedTitle?: string) => {
    const userMessages = messages.filter((m) => m.sender === "user")
    let finalTitle = "Nuova Conversazione"

    if (userMessages.length >= 2) {
      finalTitle = userMessages[1].text.substring(0, 40) + "..."
    } else if (userMessages.length === 1) {
      finalTitle = userMessages[0].text.substring(0, 40) + "..."
    }

    if (generatedTitle) {
      finalTitle = generatedTitle
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
    localStorage.setItem("simone-ai-chats", JSON.stringify(newChats))
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
      const sessionId = localStorage.getItem("simone-ai-session-id") || Math.random().toString(36).slice(2, 11)
      localStorage.setItem("simone-ai-session-id", sessionId)

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
          metadata: { source: "simone-ai-chat" },
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

      setTimeout(() => saveChat(generatedTitle || undefined), 100)

      function handleEvent(jsonStr: string) {
        let obj
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
    <div className="flex h-screen overflow-hidden bg-white">
      {/* Sidebar */}
      <div
        className={`${
          sidebarVisible ? "w-80" : "w-0"
        } flex-shrink-0 border-r border-gray-200 bg-white transition-all duration-300 overflow-hidden`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 bg-white p-5">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#235E84] text-white font-semibold">
                  SA
                </div>
                <div className="text-xl font-semibold text-gray-700">Simone AI</div>
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
                className={`mb-0.5 flex cursor-pointer items-center justify-between rounded-lg p-4 transition-all hover:bg-blue-50 ${
                  id === currentChatId ? "bg-blue-100" : ""
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
      </div>

      {/* Main Chat Area */}
      <div className="flex flex-1 flex-col">
        {/* Header */}
        <div className="flex min-h-[80px] items-center justify-between border-b border-gray-200 bg-[#235E84] px-10 py-5">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSidebar}
              className="flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20"
              title="Mostra/Nascondi conversazioni"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              href="/"
              className="flex items-center justify-center rounded-lg border border-white/20 bg-white/10 p-2.5 text-white transition-all hover:bg-white/20"
              title="Torna alla dashboard"
            >
              <Home className="h-5 w-5" />
            </Link>
            <div className="text-xl font-semibold text-white">Simone AI - Consulenza SEO Copywriting</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white px-20 py-12">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`mb-8 flex items-start gap-5 ${
                message.sender === "user" ? "flex-row-reverse ml-auto max-w-[90%]" : "max-w-[90%]"
              }`}
            >
              <div
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                  message.sender === "ai"
                    ? "bg-gradient-to-br from-[#235E84] to-[#1a4a66] text-white"
                    : "bg-blue-100 text-[#235E84]"
                }`}
              >
                {message.sender === "ai" ? "SA" : "U"}
              </div>
              <div
                className={`flex-1 rounded-xl border px-6 py-5 ${
                  message.sender === "user"
                    ? "border-[#235E84] bg-[#235E84] text-white"
                    : "border-gray-200 bg-white text-black"
                }`}
              >
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap">{message.text}</div>
                {message.time && (
                  <div className={`mt-2 text-xs ${message.sender === "user" ? "text-white/70" : "text-gray-500"}`}>
                    {message.time}
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
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Scrivi la tua domanda per Simone..."
              disabled={isLoading}
              className="flex-1 resize-none border-none bg-transparent text-[15px] text-black outline-none placeholder:text-gray-400"
              rows={1}
              style={{ minHeight: "24px", maxHeight: "120px" }}
            />
            <button
              onClick={sendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#235E84] text-white transition-all hover:scale-105 disabled:bg-gray-300 disabled:cursor-not-allowed"
              title="Invia (Invio)"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
