"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { Home } from "lucide-react"

export default function AlexAIPage() {
  const [messages, setMessages] = useState<
    Array<{ sender: string; text: string; time: string; attachments?: Array<{ name: string }> }>
  >([])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [useMemory, setUseMemory] = useState(true)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [currentChatId, setCurrentChatId] = useState("default")
  const [chats, setChats] = useState<Record<string, any>>({})
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [modalFiles, setModalFiles] = useState<File[]>([])

  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const CURRENT_NAMESPACE = useRef<string>("")

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/65c03f65-d13c-43c7-967d-708dcceef965/chat?action=sendMessage"

  useEffect(() => {
    let ns = localStorage.getItem("Namespace")
    if (!ns) {
      ns = generateUUID()
      localStorage.setItem("Namespace", ns)
    }
    CURRENT_NAMESPACE.current = ns

    const savedMemory = localStorage.getItem("alex-ai-use-memory")
    setUseMemory(savedMemory !== "false")

    const savedSidebar = localStorage.getItem("alex-ai-sidebar-visible")
    setSidebarVisible(savedSidebar !== "false")

    const savedChats = JSON.parse(localStorage.getItem("alex-ai-chats") || "{}")
    setChats(savedChats)

    if (Object.keys(savedChats).length > 0) {
      const sortedIds = Object.keys(savedChats).sort((a, b) => savedChats[b].timestamp - savedChats[a].timestamp)
      const lastChatId = sortedIds[0]
      setCurrentChatId(lastChatId)
      setMessages(savedChats[lastChatId].messages || [])
    } else {
      createNewChat()
    }
  }, [])

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    localStorage.setItem("alex-ai-use-memory", String(useMemory))
  }, [useMemory])

  useEffect(() => {
    localStorage.setItem("alex-ai-sidebar-visible", String(sidebarVisible))
  }, [sidebarVisible])

  function generateUUID(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  function generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  function createNewChat() {
    const newChatId = generateSessionId()
    setCurrentChatId(newChatId)
    localStorage.setItem("alex-ai-session-id", newChatId)
    const welcomeMsg = {
      sender: "ai",
      text: "Ciao! Sono Alex AI, il tuo Cross-Platform Ads Strategist di livello mondiale specializzato nella creazione e ottimizzazione di campagne pubblicitarie integrate. Come posso supportarti oggi?",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
    }
    setMessages([welcomeMsg])
    setPendingFiles([])
    setInputValue("")
    saveChat(newChatId, [welcomeMsg], "Nuova Chat")
  }

  function saveChat(chatId: string, msgs: any[], title?: string) {
    const chatTitle =
      title || chats[chatId]?.title || msgs.find((m) => m.sender === "ai")?.text?.substring(0, 30) || "Nuova Chat"
    const updatedChats = {
      ...chats,
      [chatId]: {
        title: chatTitle,
        messages: msgs,
        timestamp: Date.now(),
      },
    }
    setChats(updatedChats)
    localStorage.setItem("alex-ai-chats", JSON.stringify(updatedChats))
  }

  function loadChat(chatId: string) {
    if (!chats[chatId]) return
    setCurrentChatId(chatId)
    setMessages(chats[chatId].messages || [])
    localStorage.setItem("alex-ai-session-id", chatId)
  }

  function deleteChat(chatId: string) {
    if (!confirm("Sei sicuro di voler eliminare questa chat?")) return
    const updatedChats = { ...chats }
    delete updatedChats[chatId]
    setChats(updatedChats)
    localStorage.setItem("alex-ai-chats", JSON.stringify(updatedChats))
    if (chatId === currentChatId) {
      createNewChat()
    }
  }

  function cleanText(s: string): string {
    return (s || "")
      .replace(/\u0000/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  function chunkSmart(text: string, size = 1000, overlap = 200): string[] {
    text = cleanText(text)
    const chunks: string[] = []
    const words = text.split(/\s+/)
    let current = ""

    for (const word of words) {
      if ((current + " " + word).length <= size) {
        current += (current ? " " : "") + word
      } else {
        if (current) chunks.push(current)
        current = word
      }
    }
    if (current) chunks.push(current)

    if (overlap > 0 && chunks.length > 1) {
      const out = [chunks[0]]
      for (let i = 1; i < chunks.length; i++) {
        const tail = out[out.length - 1].slice(-overlap)
        out.push((tail + "\n" + chunks[i]).slice(0, size + overlap))
      }
      return out
    }
    return chunks
  }

  async function embedBatch(texts: string[]): Promise<number[][]> {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: process.env.NEXT_PUBLIC_OPENAI_MODEL || "text-embedding-3-large", input: texts }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status}`)
    return data.data.map((d: any) => d.embedding)
  }

  async function upsertVectors(vectors: any[]): Promise<any> {
    const url = `${process.env.NEXT_PUBLIC_PINECONE_HOST}/vectors/upsert`
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Api-Key": process.env.NEXT_PUBLIC_PINECONE_API_KEY || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ namespace: CURRENT_NAMESPACE.current, vectors }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`Pinecone upsert failed: ${res.status}`)
    return data
  }

  async function fileToText(file: File): Promise<string> {
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    const ab = await file.arrayBuffer()

    if (ext === "pdf") {
      try {
        const pdfjsLib = await import("pdfjs-dist")
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise
        let fullText = ""
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          fullText += content.items.map((item: any) => item.str).join(" ") + "\n\n"
        }
        console.log("[v0] PDF parsed successfully, text length:", fullText.length)
        return cleanText(fullText)
      } catch (error) {
        console.error("[v0] PDF parsing error:", error)
        return ""
      }
    }

    if (ext === "docx") {
      try {
        const mammoth = await import("mammoth")
        const result = await mammoth.extractRawText({ arrayBuffer: ab })
        return cleanText(result.value)
      } catch (error) {
        console.error("[v0] DOCX parsing error:", error)
        return ""
      }
    }

    if (ext === "xlsx" || ext === "xls") {
      try {
        const XLSX = await import("xlsx")
        const workbook = XLSX.read(ab, { type: "array" })
        let allText = ""
        workbook.SheetNames.forEach((name) => {
          const worksheet = workbook.Sheets[name]
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: true }) as any[]
          rows.forEach((row) => {
            allText += (row || []).join(" | ") + "\n"
          })
          allText += "\n"
        })
        return cleanText(allText)
      } catch (error) {
        console.error("[v0] XLSX parsing error:", error)
        return ""
      }
    }

    return cleanText(new TextDecoder().decode(ab))
  }

  async function indexFilesToPinecone(files: File[]): Promise<void> {
    const nowIso = new Date().toISOString()
    const all: Array<{ id: string; text: string; metadata: any }> = []

    for (const f of files) {
      const text = await fileToText(f)
      if (!text.trim()) continue
      const chunks = chunkSmart(text, 1000, 200)
      const docId = `${f.name}:${Date.now()}`
      chunks.forEach((c, i) =>
        all.push({
          id: `${docId}#${i}`,
          text: c,
          metadata: {
            text: c,
            file_name: f.name,
            doc_id: docId,
            chunk_index: i,
            source: f.type || f.name.split(".").pop(),
            size_bytes: f.size || 0,
            uploaded_at: nowIso,
            app: "AlexAI-Uploader",
            chat_id: currentChatId,
          },
        }),
      )
    }

    if (!all.length) return

    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100)
      const embs = await embedBatch(batch.map((d) => d.text))
      const vecs = batch.map((d, idx) => ({ id: d.id, values: embs[idx], metadata: d.metadata }))
      await upsertVectors(vecs)
    }
  }

  async function upsertMessageToPinecone(message: string, sender: string): Promise<boolean> {
    try {
      const sessionId = localStorage.getItem("alex-ai-session-id") || generateSessionId()
      const nowIso = new Date().toISOString()
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const embeddings = await embedBatch([message])
      if (!embeddings || !embeddings[0]) throw new Error("Failed to generate embedding")

      const vector = {
        id: messageId,
        values: embeddings[0],
        metadata: {
          text: message,
          sender: sender,
          session_id: sessionId,
          chat_id: currentChatId,
          timestamp: nowIso,
          source: "alex-ai-chat-message",
          app: "AlexAI",
          namespace: CURRENT_NAMESPACE.current,
        },
      }
      await upsertVectors([vector])
      return true
    } catch (error) {
      console.error(`[v0] Failed to upsert ${sender} message:`, error)
      return false
    }
  }

  async function sendMessage() {
    const message = inputValue.trim()
    if (!message && pendingFiles.length === 0) return

    setIsLoading(true)
    const userMsg = {
      sender: "user",
      text: message || "📎 Allegati",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      attachments: pendingFiles.map((f) => ({ name: f.name })),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInputValue("")

    if (pendingFiles.length) {
      try {
        await indexFilesToPinecone(pendingFiles)
      } catch (e) {
        console.error("[v0] Attachment indexing error:", e)
      }
      setPendingFiles([])
    }

    const thinkingMsg = { sender: "ai", text: "...", time: "Ora" }
    setMessages([...newMessages, thinkingMsg])

    try {
      const sessionId = localStorage.getItem("alex-ai-session-id") || generateSessionId()
      localStorage.setItem("alex-ai-session-id", sessionId)

      const res = await fetch(N8N_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          action: "sendMessage",
          chatInput: message || "(allegati inviati)",
          sessionId,
          useMemory,
          metadata: {
            source: "alex-ai-chat",
            attachments: pendingFiles.length > 0,
            namespace: CURRENT_NAMESPACE.current,
          },
        }),
      })

      if (!res.ok) throw new Error("HTTP error " + res.status)

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""
      let generatedTitle = null

      const handleEvent = (jsonStr: string) => {
        let obj: any
        try {
          obj = JSON.parse(jsonStr)
        } catch {
          return
        }
        if (obj.type === "item" && typeof obj.content === "string") {
          rawText += obj.content
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              sender: "ai",
              text: rawText,
              time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
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

        const lines = buffer.split(/\r?\n/)
        buffer = lines.pop() || ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith("data:")) {
            const jsonStr = trimmed.replace(/^data:\s?/, "")
            if (jsonStr) handleEvent(jsonStr)
          } else if (trimmed) {
            handleEvent(trimmed)
          }
        }
      }

      const finalMessages = [
        ...newMessages,
        {
          sender: "ai",
          text: rawText || "Mi dispiace, non ho ricevuto una risposta valida.",
          time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
        },
      ]
      setMessages(finalMessages)
      saveChat(currentChatId, finalMessages, generatedTitle || undefined)
    } catch (err) {
      console.error("[v0] Error with streaming request:", err)
      const errorMsg = {
        sender: "ai",
        text: "Errore di connessione. Riprova più tardi.",
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      }
      setMessages([...newMessages, errorMsg])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if ((inputValue.trim() || pendingFiles.length > 0) && !isLoading) sendMessage()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setModalFiles((prev) => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const attachFilesToChat = () => {
    setPendingFiles((prev) => [...prev, ...modalFiles])
    setModalFiles([])
    setShowUploadModal(false)
  }

  const formatMessageText = (text: string) => {
    let t = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>")
    t = t.replace(/`([^`]+?)`/g, "<code>$1</code>")
    t = t.replace(/\[([^\]]+?)\]\$\$(https?:\/\/[^\s)]+)\$\$/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    t = t.replace(/\n/g, "<br>")
    return t
  }

  return (
    <>
      <style jsx global>{`
        .alex-ai-container * { margin: 0; padding: 0; box-sizing: border-box; }
        .alex-ai-container { width: 100%; height: 100vh; font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; position: relative; overflow: hidden; background: #ffffff; }
        .alex-ai-app { background: #ffffff; width: 100%; height: 100%; display: flex; overflow: hidden; position: relative; }
        
        /* Added responsive sidebar with mobile menu */
        .alex-ai-sidebar { 
          width: 320px; 
          min-width: 320px; 
          background: #ffffff; 
          border-right: 1px solid #e2e8f0; 
          display: flex; 
          flex-direction: column; 
          transition: all 0.3s; 
          position: relative; 
        }
        
        @media (max-width: 1024px) {
          .alex-ai-sidebar { width: 280px; min-width: 280px; }
        }
        
        @media (max-width: 768px) {
          .alex-ai-sidebar {
            position: fixed;
            left: 0;
            top: 0;
            height: 100vh;
            width: 85%;
            max-width: 320px;
            z-index: 1000;
            transform: translateX(-100%);
            box-shadow: 4px 0 20px rgba(0, 0, 0, 0.15);
          }
          .alex-ai-sidebar:not(.hidden) {
            transform: translateX(0);
          }
        }
        
        .alex-ai-sidebar.hidden { width: 0; min-width: 0; overflow: hidden; border-right: none; }
        
        @media (max-width: 768px) {
          .alex-ai-sidebar.hidden {
            transform: translateX(-100%);
          }
        }
        
        .alex-ai-sidebar-header { padding: 20px; border-bottom: 1px solid #e2e8f0; background: #ffffff; }
        
        @media (max-width: 768px) {
          .alex-ai-sidebar-header { padding: 16px; }
        }
        
        .alex-ai-brand-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
        
        @media (max-width: 768px) {
          .alex-ai-brand-header { margin-bottom: 16px; }
        }
        
        .alex-ai-brand-section { display: flex; align-items: center; gap: 12px; }
        .alex-ai-brand-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 600; color: #475569; }
        
        @media (max-width: 768px) {
          .alex-ai-brand-title { font-size: 18px; }
        }
        
        /* Added mobile close button */
        .alex-ai-close-sidebar-btn {
          display: none;
          background: rgba(35, 94, 132, 0.1);
          border: 1px solid rgba(35, 94, 132, 0.2);
          color: #235E84;
          width: 32px;
          height: 32px;
          border-radius: 6px;
          cursor: pointer;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }
        
        @media (max-width: 768px) {
          .alex-ai-close-sidebar-btn { display: flex; }
        }
        
        .alex-ai-close-sidebar-btn:hover {
          background: rgba(35, 94, 132, 0.2);
        }
        
        .alex-ai-profile-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; background: #235E84; }
        
        @media (max-width: 768px) {
          .alex-ai-profile-avatar { width: 36px; height: 36px; }
        }
        
        .alex-ai-profile-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .alex-ai-new-chat-btn { background: #235E84; border: none; color: #ffffff; padding: 14px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s; width: 100%; }
        
        @media (max-width: 768px) {
          .alex-ai-new-chat-btn { padding: 12px 16px; font-size: 13px; }
        }
        
        .alex-ai-new-chat-btn:hover { background: #1a4a68; transform: translateY(-1px); }
        .alex-ai-memory-toggle { display: flex; align-items: center; justify-content: space-between; padding: 16px 0 0 0; font-size: 14px; font-weight: 500; color: #475569; }
        
        @media (max-width: 768px) {
          .alex-ai-memory-toggle { font-size: 13px; padding: 12px 0 0 0; }
        }
        
        .alex-ai-switch { position: relative; display: inline-block; width: 44px; height: 24px; }
        .alex-ai-switch input { opacity: 0; width: 0; height: 0; }
        .alex-ai-slider { position: absolute; cursor: pointer; inset: 0; background-color: #ccc; transition: 0.4s; border-radius: 24px; }
        .alex-ai-slider:before { position: absolute; content: ''; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.4s; border-radius: 50%; }
        .alex-ai-switch input:checked + .alex-ai-slider { background-color: #235E84; }
        .alex-ai-switch input:checked + .alex-ai-slider:before { transform: translateX(20px); }
        .alex-ai-sidebar-split { flex: 1; display: flex; flex-direction: column; min-height: 0; overflow: hidden; }
        .alex-ai-chat-list-wrapper { flex: 1 1 auto; max-height: 40%; overflow-y: auto; padding: 16px 20px; min-height: 100px; }
        
        @media (max-width: 768px) {
          .alex-ai-chat-list-wrapper { padding: 12px 16px; }
        }
        
        .alex-ai-chat-item { padding: 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; margin-bottom: 2px; background: transparent; position: relative; display: flex; justify-content: space-between; align-items: center; }
        
        @media (max-width: 768px) {
          .alex-ai-chat-item { padding: 12px; }
        }
        
        .alex-ai-chat-item:hover { background: #E3F2FD; }
        .alex-ai-chat-item.active { background: #E3F2FD; color: #235E84; }
        .alex-ai-chat-item-content { flex: 1; min-width: 0; }
        .alex-ai-chat-item-title { font-weight: 500; font-size: 14px; color: #475569; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        @media (max-width: 768px) {
          .alex-ai-chat-item-title { font-size: 13px; }
        }
        
        .alex-ai-chat-item-subtitle { font-size: 12px; color: #64748b; }
        
        @media (max-width: 768px) {
          .alex-ai-chat-item-subtitle { font-size: 11px; }
        }
        
        .alex-ai-delete-btn { opacity: 0; background: #ef4444; border: none; color: white; width: 24px; height: 24px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; font-size: 12px; flex-shrink: 0; }
        .alex-ai-chat-item:hover .alex-ai-delete-btn { opacity: 1; }
        .alex-ai-delete-btn:hover { background: #dc2626; }
        .alex-ai-agents-section { flex: 1 1 auto; min-height: 150px; margin-top: 0; padding: 16px 20px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; flex-direction: column; overflow: hidden; }
        
        @media (max-width: 768px) {
          .alex-ai-agents-section { padding: 12px 16px; padding-top: 12px; }
        }
        
        .alex-ai-agents-title { font-family: 'Montserrat', sans-serif; font-size: 16px; font-weight: 600; color: #475569; margin-bottom: 16px; padding: 0 4px; flex-shrink: 0; }
        
        @media (max-width: 768px) {
          .alex-ai-agents-title { font-size: 14px; margin-bottom: 12px; }
        }
        
        .alex-ai-agents-list { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; min-height: 0; }
        
        .alex-ai-agents-list::-webkit-scrollbar { width: 6px; }
        .alex-ai-agents-list::-webkit-scrollbar-track { background: transparent; }
        .alex-ai-agents-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .alex-ai-agents-list::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        
        .alex-ai-agent-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; border-radius: 8px; text-decoration: none; color: #475569; transition: background-color 0.2s; flex-shrink: 0; }
        
        @media (max-width: 768px) {
          .alex-ai-agent-item { padding: 8px 10px; gap: 10px; }
        }
        
        .alex-ai-agent-item:hover { background-color: #E3F2FD; }
        .alex-ai-agent-avatar { width: 32px; height: 32px; border-radius: 50%; background: #f8fafc; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; color: #64748b; }
        
        @media (max-width: 768px) {
          .alex-ai-agent-avatar { width: 28px; height: 28px; }
        }
        
        .alex-ai-agent-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .alex-ai-agent-name { font-size: 14px; font-weight: 500; }
        
        @media (max-width: 768px) {
          .alex-ai-agent-name { font-size: 13px; }
        }
        
        .alex-ai-chat-container { flex: 1; display: flex; flex-direction: column; min-width: 0; background: #ffffff; position: relative; }
        .alex-ai-chat-header { background: #235E84; color: #ffffff; padding: 20px 40px; border-bottom: 1px solid #e2e8f0; display: flex; align-items: center; justify-content: space-between; min-height: 80px; }
        
        @media (max-width: 1024px) {
          .alex-ai-chat-header { padding: 16px 24px; min-height: 70px; }
        }
        
        @media (max-width: 768px) {
          .alex-ai-chat-header { padding: 14px 16px; min-height: 64px; }
        }
        
        .alex-ai-header-left { display: flex; align-items: center; gap: 16px; min-width: 0; flex: 1; }
        
        @media (max-width: 768px) {
          .alex-ai-header-left { gap: 12px; }
        }
        
        .alex-ai-header-right { display: flex; gap: 12px; align-items: center; flex-shrink: 0; }
        
        @media (max-width: 768px) {
          .alex-ai-header-right { gap: 8px; }
        }
        
        /* Made toggle button work as hamburger menu on mobile */
        .alex-ai-toggle-btn { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); padding: 10px; border-radius: 8px; cursor: pointer; color: #ffffff; transition: all 0.2s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        
        @media (max-width: 768px) {
          .alex-ai-toggle-btn { padding: 8px; }
          .alex-ai-toggle-btn svg { width: 22px; height: 22px; }
        }
        
        .alex-ai-toggle-btn:hover { background: rgba(255, 255, 255, 0.2); }
        .alex-ai-chat-title { font-family: 'Montserrat', sans-serif; font-size: 20px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        @media (max-width: 1024px) {
          .alex-ai-chat-title { font-size: 18px; }
        }
        
        @media (max-width: 768px) {
          .alex-ai-chat-title { font-size: 16px; }
        }
        
        @media (max-width: 480px) {
          .alex-ai-chat-title { font-size: 14px; }
        }
        
        .alex-ai-home-btn { background: rgba(255, 255, 255, 0.1); border: 1px solid rgba(255, 255, 255, 0.2); padding: 10px 14px; border-radius: 8px; cursor: pointer; color: #ffffff; transition: all 0.2s; display: flex; align-items: center; gap: 8px; text-decoration: none; font-size: 14px; font-weight: 500; }
        
        @media (max-width: 768px) {
          .alex-ai-home-btn { padding: 8px 10px; font-size: 0; gap: 0; }
          .alex-ai-home-btn svg { width: 18px; height: 18px; }
        }
        
        .alex-ai-home-btn:hover { background: rgba(255, 255, 255, 0.2); }
        
        .alex-ai-messages { flex: 1; overflow-y: auto; padding: 50px 80px; background: #ffffff; min-height: 0; }
        
        @media (max-width: 1024px) {
          .alex-ai-messages { padding: 40px 50px; }
        }
        
        @media (max-width: 768px) {
          .alex-ai-messages { padding: 30px 20px; }
        }
        
        @media (max-width: 480px) {
          .alex-ai-messages { padding: 20px 16px; }
        }
        
        .alex-ai-message { margin-bottom: 32px; display: flex; align-items: flex-start; gap: 20px; max-width: 90%; }
        
        @media (max-width: 768px) {
          .alex-ai-message { margin-bottom: 24px; gap: 12px; max-width: 95%; }
        }
        
        .alex-ai-message.user { flex-direction: row-reverse; margin-left: auto; }
        .alex-ai-message-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 14px; flex-shrink: 0; overflow: hidden; }
        
        @media (max-width: 768px) {
          .alex-ai-message-avatar { width: 32px; height: 32px; font-size: 12px; }
        }
        
        .alex-ai-message-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .alex-ai-message.ai .alex-ai-message-avatar { background: linear-gradient(135deg, #235E84 0%, #1a4a68 100%); color: #ffffff; }
        .alex-ai-message.user .alex-ai-message-avatar { background: #E3F2FD; color: #235E84; }
        .alex-ai-message-content { flex: 1; background: #ffffff; padding: 20px 24px; border-radius: 12px; border: 1px solid #e2e8f0; min-width: 200px; }
        
        @media (max-width: 768px) {
          .alex-ai-message-content { padding: 14px 16px; min-width: 150px; }
        }
        
        .alex-ai-message.user .alex-ai-message-content { background: #235E84; color: #ffffff; border-color: #235E84; }
        .alex-ai-message-text { color: #334155; line-height: 1.6; font-size: 15px; word-wrap: break-word; }
        
        @media (max-width: 768px) {
          .alex-ai-message-text { font-size: 14px; }
        }
        
        .alex-ai-message.user .alex-ai-message-text { color: #ffffff; }
        .alex-ai-message-time { font-size: 12px; color: #64748b; margin-top: 8px; }
        
        @media (max-width: 768px) {
          .alex-ai-message-time { font-size: 11px; margin-top: 6px; }
        }
        
        .alex-ai-message.user .alex-ai-message-time { color: rgba(255, 255, 255, 0.7); }
        .alex-ai-attachment-list { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
        .alex-ai-attachment-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; background: #f8fafc; color: #334155; border: 1px solid #e2e8f0; }
        
        @media (max-width: 768px) {
          .alex-ai-attachment-pill { padding: 5px 8px; font-size: 11px; }
        }
        
        .alex-ai-message.user .alex-ai-attachment-pill { background: rgba(255, 255, 255, 0.15); color: #fff; border-color: rgba(255, 255, 255, 0.25); }
        .alex-ai-input-container { padding: 30px 80px; border-top: 1px solid #e2e8f0; background: #ffffff; }
        
        @media (max-width: 1024px) {
          .alex-ai-input-container { padding: 24px 50px; }
        }
        
        @media (max-width: 768px) {
          .alex-ai-input-container { padding: 16px 20px; }
        }
        
        @media (max-width: 480px) {
          .alex-ai-input-container { padding: 12px 16px; }
        }
        
        .alex-ai-input-wrapper { display: flex; align-items: flex-end; gap: 12px; background: #ffffff; border: 2px solid #e2e8f0; border-radius: 12px; padding: 12px 16px; transition: all 0.2s; }
        
        @media (max-width: 768px) {
          .alex-ai-input-wrapper { padding: 10px 12px; gap: 10px; }
        }
        
        .alex-ai-input-wrapper:focus-within { border-color: #235E84; box-shadow: 0 0 0 3px rgba(35, 94, 132, 0.1); }
        .alex-ai-input { flex: 1; border: none; outline: none; background: transparent; font-size: 15px; color: #475569; resize: none; min-height: 24px; max-height: 120px; font-family: inherit; }
        
        @media (max-width: 768px) {
          .alex-ai-input { font-size: 14px; }
        }
        
        .alex-ai-input::placeholder { color: #64748b; }
        .alex-ai-attach-btn { position: relative; background: transparent; border: 2px solid #e2e8f0; color: #475569; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 0.2s; }
        
        @media (max-width: 768px) {
          .alex-ai-attach-btn { width: 36px; height: 36px; }
        }
        
        .alex-ai-attach-btn:hover { background: #E3F2FD; border-color: #235E84; color: #235E84; transform: scale(1.05); }
        .alex-ai-attach-badge { position: absolute; top: -6px; right: -6px; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; background: #ef4444; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
        
        @media (max-width: 768px) {
          .alex-ai-attach-badge { min-width: 16px; height: 16px; font-size: 10px; }
        }
        
        .alex-ai-send-btn { background: #235E84; border: none; color: #ffffff; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; flex-shrink: 0; }
        
        @media (max-width: 768px) {
          .alex-ai-send-btn { width: 36px; height: 36px; }
        }
        
        .alex-ai-send-btn:hover:not(:disabled) { background: #1a4a68; transform: scale(1.05); }
        .alex-ai-send-btn:disabled { background: #cbd5e1; color: #64748b; cursor: not-allowed; }
        .alex-ai-thinking { display: flex; align-items: center; gap: 5px; }
        .alex-ai-thinking .dot { width: 8px; height: 8px; background-color: #64748b; border-radius: 50%; animation: thinking 1.4s infinite ease-in-out both; }
        .alex-ai-thinking .dot:nth-child(2) { animation-delay: 0.2s; }
        .alex-ai-thinking .dot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes thinking { 0%, 60%, 100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-10px); opacity: 1; } }
        
        .alex-ai-modal { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.45); display: flex; align-items: center; justify-content: center; z-index: 9999; padding: 20px; }
        .alex-ai-modal-card { width: min(980px, 95vw); background: #0f172a; color: #e5e7eb; border-radius: 14px; border: 2px solid #235E84; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45); overflow: hidden; }
        
        @media (max-width: 768px) {
          .alex-ai-modal-card { width: 100%; max-width: 500px; }
        }
        
        .alex-ai-modal-head { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #235E84; color: #fff; font-weight: 700; font-size: 15px; }
        
        @media (max-width: 768px) {
          .alex-ai-modal-head { padding: 12px 14px; font-size: 14px; }
        }
        
        .alex-ai-modal-body { padding: 16px; }
        
        @media (max-width: 768px) {
          .alex-ai-modal-body { padding: 14px; }
        }
        
        .alex-ai-modal-drop { border: 2px dashed #334155; border-radius: 14px; padding: 18px; text-align: center; background: #111827; }
        
        @media (max-width: 768px) {
          .alex-ai-modal-drop { padding: 14px; font-size: 14px; }
        }
        
        .alex-ai-modal-files { margin-top: 10px; }
        .alex-ai-modal-filepill { display: inline-block; margin: 4px 6px 0 0; padding: 4px 8px; border-radius: 999px; border: 1px solid #334155; background: #0b1220; font-size: 12px; }
        
        @media (max-width: 768px) {
          .alex-ai-modal-filepill { font-size: 11px; padding: 3px 7px; }
        }
        
        .alex-ai-modal-row { display: flex; align-items: center; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
        .alex-ai-modal-btn { background: #235E84; color: #fff; border: 0; padding: 10px 14px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 14px; }
        
        @media (max-width: 768px) {
          .alex-ai-modal-btn { padding: 9px 12px; font-size: 13px; }
        }
        
        .alex-ai-modal-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .alex-ai-modal-close { background: rgba(255, 255, 255, 0.15); color: #fff; border: 1px solid rgba(255, 255, 255, 0.25); padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 14px; }
        
        @media (max-width: 768px) {
          .alex-ai-modal-close { padding: 7px 9px; font-size: 13px; }
        }
        
        /* Added mobile overlay for sidebar */
        @media (max-width: 768px) {
          .alex-ai-sidebar-overlay {
            display: none;
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
          }
          .alex-ai-sidebar:not(.hidden) ~ .alex-ai-sidebar-overlay {
            display: block;
          }
        }
      `}</style>

      <div className="alex-ai-container">
        <div className="alex-ai-app">
          <div className={`alex-ai-sidebar ${!sidebarVisible ? "hidden" : ""}`}>
            <div className="alex-ai-sidebar-header">
              <div className="alex-ai-brand-header">
                <div className="alex-ai-brand-section">
                  <div className="alex-ai-profile-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png"
                      alt="Alex AI"
                    />
                  </div>
                  <div className="alex-ai-brand-title">Alex AI</div>
                </div>
                <button className="alex-ai-close-sidebar-btn" onClick={() => setSidebarVisible(false)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                  </svg>
                </button>
              </div>
              <button className="alex-ai-new-chat-btn" onClick={createNewChat}>
                <span>+</span> Nuova Chat
              </button>
              <div className="alex-ai-memory-toggle">
                <label htmlFor="memoryToggle">Usa Memoria</label>
                <label className="alex-ai-switch">
                  <input
                    type="checkbox"
                    id="memoryToggle"
                    checked={useMemory}
                    onChange={(e) => setUseMemory(e.target.checked)}
                  />
                  <span className="alex-ai-slider"></span>
                </label>
              </div>
            </div>

            <div className="alex-ai-sidebar-split">
              <div className="alex-ai-chat-list-wrapper">
                {Object.keys(chats)
                  .sort((a, b) => chats[b].timestamp - chats[a].timestamp)
                  .map((id) => (
                    <div
                      key={id}
                      className={`alex-ai-chat-item ${id === currentChatId ? "active" : ""}`}
                      onClick={() => loadChat(id)}
                    >
                      <div className="alex-ai-chat-item-content">
                        <div className="alex-ai-chat-item-title">{chats[id].title || "Nuova Chat"}</div>
                        <div className="alex-ai-chat-item-subtitle">
                          {new Date(chats[id].timestamp).toLocaleString("it-IT", {
                            day: "numeric",
                            month: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      </div>
                      <button
                        className="alex-ai-delete-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteChat(id)
                        }}
                      >
                        ✖
                      </button>
                    </div>
                  ))}
              </div>

              <div className="alex-ai-agents-section">
                <h3 className="alex-ai-agents-title">AGENTI AI:</h3>
                <div className="alex-ai-agents-list">
                  <a
                    href="https://members.digital-coach.com/products/tony-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png"
                        alt="Tony"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Tony AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/aladdin-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png"
                        alt="Aladino"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Aladino AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/lara-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png"
                        alt="Lara"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Lara AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/simone-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png"
                        alt="Simone"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Simone AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/mike-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png"
                        alt="Mike"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Mike AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/valentina-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png"
                        alt="Valentina"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Valentina AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/niko-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png" alt="Niko" />
                    </div>
                    <span className="alex-ai-agent-name">Niko AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/jim-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png"
                        alt="Jim"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Jim AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/daniele-ai"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png"
                        alt="Daniele"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Daniele AI</span>
                  </a>
                  <a
                    href="https://members.digital-coach.com/products/alex-ai-2-0"
                    target="_blank"
                    className="alex-ai-agent-item"
                    rel="noreferrer"
                  >
                    <div className="alex-ai-agent-avatar">
                      <img
                        src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png"
                        alt="Alex"
                      />
                    </div>
                    <span className="alex-ai-agent-name">Alex AI</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="alex-ai-chat-container">
            <div className="alex-ai-chat-header">
              <div className="alex-ai-header-left">
                <button className="alex-ai-toggle-btn" onClick={() => setSidebarVisible(!sidebarVisible)}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    {sidebarVisible ? (
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    ) : (
                      <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                    )}
                  </svg>
                </button>
                <div className="alex-ai-chat-title">Alex AI - Cross-platform ADs Manager</div>
              </div>
              <div className="alex-ai-header-right">
                <Link href="/" className="alex-ai-home-btn">
                  <Home size={18} />
                  Home
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "w-10 h-10",
                    },
                  }}
                />
              </div>
            </div>

            <div className="alex-ai-messages" ref={chatMessagesRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`alex-ai-message ${msg.sender}`}>
                  <div className="alex-ai-message-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png"
                      alt={msg.sender === "user" ? "User" : "Alex AI"}
                    />
                  </div>
                  <div className="alex-ai-message-content">
                    <div className="alex-ai-message-text">
                      {msg.text === "..." ? (
                        <div className="alex-ai-thinking">
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                        </div>
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }} />
                      )}
                    </div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="alex-ai-attachment-list">
                        {msg.attachments.map((att, i) => (
                          <span key={i} className="alex-ai-attachment-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M16.5 6.5l-7.78 7.78a3 3 0 104.24 4.24l7.78-7.78a5 5 0 10-7.07-7.07L5.1 10.24a7 7 0 109.9 9.9l6.36-6.36-1.41-1.41-6.36 6.36a5 5 0 11-7.07-7.07l8.48-8.49a3 3 0 114.24 4.25l-7.79 7.78a1 1 0 01-1.41-1.41L15.09 8" />
                            </svg>
                            <span>{att.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.text !== "..." && <div className="alex-ai-message-time">{msg.time}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="alex-ai-input-container">
              <div className="alex-ai-input-wrapper">
                <button className="alex-ai-attach-btn" onClick={() => setShowUploadModal(true)}>
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M16.5 6.5l-7.78 7.78a3 3 0 104.24 4.24l7.78-7.78a5 5 0 10-7.07-7.07L5.1 10.24a7 7 0 109.9 9.9l6.36-6.36-1.41-1.41-6.36 6.36a5 5 0 11-7.07-7.07l8.48-8.49a3 3 0 114.24 4.25l-7.79 7.78a1 1 0 01-1.41-1.41L15.09 8" />
                  </svg>
                  {pendingFiles.length > 0 && <span className="alex-ai-attach-badge">{pendingFiles.length}</span>}
                </button>
                <textarea
                  ref={textareaRef}
                  className="alex-ai-input"
                  placeholder="Scrivi la tua domanda per Alex..."
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    e.target.style.height = "auto"
                    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
                  }}
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                  rows={1}
                />
                <button
                  className="alex-ai-send-btn"
                  onClick={sendMessage}
                  disabled={(!inputValue.trim() && pendingFiles.length === 0) || isLoading}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        {/* Added overlay for mobile sidebar */}
        <div
          className="alex-ai-sidebar-overlay"
          onClick={() => setSidebarVisible(false)}
          style={{ display: sidebarVisible ? "block" : "none" }}
        ></div>
      </div>

      {showUploadModal && (
        <div className="alex-ai-modal" onClick={() => setShowUploadModal(false)}>
          <div className="alex-ai-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="alex-ai-modal-head">
              <div>Seleziona i file da allegare alla chat</div>
              <button className="alex-ai-modal-close" onClick={() => setShowUploadModal(false)}>
                Chiudi ✕
              </button>
            </div>
            <div className="alex-ai-modal-body">
              <div className="alex-ai-modal-drop">
                <strong>Trascina qui i file</strong> oppure{" "}
                <label htmlFor="fileInput" style={{ textDecoration: "underline", cursor: "pointer", color: "#93c5fd" }}>
                  sfoglia
                </label>
                <input
                  id="fileInput"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
                <div className="alex-ai-modal-files">
                  {modalFiles.map((f, i) => (
                    <span key={i} className="alex-ai-modal-filepill">
                      {f.name}
                    </span>
                  ))}
                </div>
                <div style={{ opacity: 0.75, fontSize: "12px", marginTop: "6px" }}>
                  PDF, DOCX, TXT/MD, CSV, XLS/XLSX
                </div>
              </div>
              <div className="alex-ai-modal-row">
                <button className="alex-ai-modal-btn" onClick={attachFilesToChat} disabled={modalFiles.length === 0}>
                  Allega alla chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}






