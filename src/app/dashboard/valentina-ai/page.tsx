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

const N8N_ENDPOINT =
  "https://n8n-c2lq.onrender.com/webhook/f5636e0e-1355-439b-b5fd-df0174e3dddb/chat?action=sendMessage"

export default function ValentinaAIPage() {
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<Record<string, Chat>>({})
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const savedChats = localStorage.getItem("valentina-ai-chats")
    if (savedChats) {
      setChats(JSON.parse(savedChats))
    }
    const savedSidebarState = localStorage.getItem("valentina-ai-sidebar-visible")
    if (savedSidebarState !== null) {
      setSidebarVisible(savedSidebarState !== "false")
    }

    setMessages([
      {
        text: "Ciao, sono Valentina AI. la tua esperta di SEO, specializzata nell'ottimizzazione dei contenuti già pubblicati e nel posizionamento sui motori di ricerca. Come posso aiutarti oggi?",
        sender: "ai",
        time: "Ora",
      },
    ])
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
    localStorage.setItem("valentina-ai-chats", JSON.stringify(updatedChats))
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
      const sessionId = localStorage.getItem("valentina-ai-session-id") || Math.random().toString(36).slice(2, 11)
      localStorage.setItem("valentina-ai-session-id", sessionId)

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
          metadata: { source: "valentina-ai-chat" },
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

  const createNewChat = () => {
    setCurrentChatId("chat_" + Date.now())
    setMessages([
      {
        text: "Ciao, sono Valentina AI. la tua esperta di SEO, specializzata nell'ottimizzazione dei contenuti già pubblicati e nel posizionamento sui motori di ricerca. Come posso aiutarti oggi?",
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
    localStorage.setItem("valentina-ai-chats", JSON.stringify(updatedChats))

    if (chatId === currentChatId) {
      const remaining = Object.keys(updatedChats)
      if (remaining.length) {
        loadChat(remaining[0])
      } else {
        createNewChat()
      }
    }
  }

  const toggleSidebar = () => {
    const newState = !sidebarVisible
    setSidebarVisible(newState)
    localStorage.setItem("valentina-ai-sidebar-visible", String(newState))
  }

  const chatItems = Object.entries(chats)
    .sort(([, a], [, b]) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime())
    .slice(0, 10)

  const formatMessageText = (text: string) => {
    if (!text) return ""

    const safeText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

    let html = safeText
      .trim()
      .split(/\n\s*\n+/)
      .map((block) => {
        const lines = block.split("\n")
        const isTable = lines.length > 1 && lines.every((line) => line.includes("|"))

        if (isTable) {
          return createTableHtml(lines)
        }

        if (block.match(/^(\s*(\*|-|\d+\.)\s.*)/)) {
          const listType = block.match(/^\s*\d+\./) ? "ol" : "ul"
          const items = lines
            .map((line) => {
              const itemContent = line.replace(/^\s*(\*|-|\d+\.)\s*/, "")
              return `<li>${itemContent}</li>`
            })
            .join("")
          return `<${listType}>${items}</${listType}>`
        }

        return `<p>${block.replace(/\n/g, "<br>")}</p>`
      })
      .join("")

    html = html.replace(/<p>#{4}\s?(.+?)<\/p>/g, "<h4>$1</h4>")
    html = html.replace(/<p>#{3}\s?(.+?)<\/p>/g, "<h3>$1</h3>")
    html = html.replace(/<p>#{2}\s?(.+?)<\/p>/g, "<h2>$1</h2>")
    html = html.replace(/<p>#\s?(.+?)<\/p>/g, "<h1>$1</h1>")

    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700 !important;">$1</strong>')
    html = html.replace(/\*(.*?)\*/g, "<em>$1</em>")
    html = html.replace(/_(.+?)_/g, "<em>$1</em>")

    return html
  }

  const createTableHtml = (rows: string[]) => {
    let html =
      '<table style="width:100%; border-collapse:collapse; margin:16px 0; font-size:14px; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,.1);">'
    for (let r = 0; r < rows.length; r++) {
      const cells = rows[r]
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim())
      if (cells.every((c) => c === "")) continue

      const isSep = cells.every((c) => /^[-\s:]+$/.test(c))
      if (isSep) continue

      const isHeader = r === 0 || (r === 1 && rows[0].includes("---"))
      const tag = isHeader ? "th" : "td"
      const style = isHeader
        ? 'style="background:#235E84; color:#fff; padding:12px 16px; text-align:left; font-weight:600; border-bottom:2px solid #235E84;"'
        : 'style="padding:12px 16px; border-bottom:1px solid #e2e8f0; color:#334155;"'

      html += "<tr>"
      for (const raw of cells) {
        const clean = raw
          .replace(/\*\*(.*?)\*\*/g, '<strong style="font-weight: 700 !important;">$1</strong>')
          .replace(/_(.+?)_/g, "<em>$1</em>")
          .replace(/\*(.*?)\*/g, "<em>$1</em>")
        html += `<${tag} ${style}>${clean}</${tag}>`
      }
      html += "</tr>"
    }
    html += "</table>"
    return html
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white">
      {/* Sidebar */}
      <div
        className={`flex min-w-[320px] flex-col border-r border-gray-200 bg-white transition-all duration-300 ${
          sidebarVisible ? "w-[320px]" : "w-0 overflow-hidden border-r-0"
        }`}
      >
        <div className="border-b border-gray-200 bg-white p-5">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#235E84]">
                <img
                  src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                  alt="Valentina AI"
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none"
                    e.currentTarget.parentElement!.innerHTML =
                      '<span class="text-sm font-semibold text-white">VA</span>'
                  }}
                />
              </div>
              <div className="font-semibold text-gray-700">Valentina AI</div>
            </div>
          </div>
          <button
            onClick={createNewChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#235E84] px-5 py-3.5 text-sm font-medium text-white transition-all hover:bg-[#1a4a66]"
          >
            <span>+</span> Nuova Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chatItems.map(([id, chat]) => (
            <div
              key={id}
              onClick={() => loadChat(id)}
              className={`group relative flex cursor-pointer items-center justify-between p-4 transition-all hover:bg-blue-50 ${
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
            <div className="text-xl font-semibold text-white">Valentina AI - SEO Optimizer</div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto bg-white px-20 py-12">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`mb-8 flex items-start gap-5 ${
                msg.sender === "user" ? "ml-auto flex-row-reverse" : ""
              } max-w-[90%]`}
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#235E84]">
                {msg.sender === "ai" ? (
                  <img
                    src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                    alt="Valentina AI"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      e.currentTarget.parentElement!.innerHTML =
                        '<span class="text-sm font-semibold text-white">VA</span>'
                    }}
                  />
                ) : (
                  <img
                    src="https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
                    alt="User"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                      e.currentTarget.parentElement!.innerHTML =
                        '<span class="text-sm font-semibold text-white">U</span>'
                    }}
                  />
                )}
              </div>
              <div className="flex-1">
                <div
                  className={`rounded-xl border p-5 shadow-sm ${
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
                        />
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                          style={{ animationDelay: "0.2s" }}
                        />
                        <div
                          className="h-2 w-2 animate-bounce rounded-full bg-gray-400"
                          style={{ animationDelay: "0.4s" }}
                        />
                      </div>
                    ) : (
                      <div
                        dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }}
                        className="prose prose-sm max-w-none [&_h1]:text-gray-900 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-gray-900 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:text-gray-900 [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1 [&_h4]:text-gray-900 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:mt-2 [&_h4]:mb-1 [&_ul]:my-3 [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:pl-6 [&_li]:mb-1 [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-bold"
                      />
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
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage()
                }
              }}
              placeholder="Scrivi la tua domanda per Valentina..."
              className="min-h-[24px] max-h-[120px] flex-1 resize-none border-none bg-transparent text-[15px] text-black outline-none placeholder:text-gray-400"
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
