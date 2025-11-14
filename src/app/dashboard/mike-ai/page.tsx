"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"

import { UserButton } from "@clerk/nextjs"
import Link from "next/link"
import { Home } from 'lucide-react'

export default function MikeAIChat() {
  const [chats, setChats] = useState<any>({})
  const [currentChatId, setCurrentChatId] = useState("default")
  const [messages, setMessages] = useState<any[]>([])
  const [inputValue, setInputValue] = useState("")
  const [useMemory, setUseMemory] = useState(true)
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalFiles, setModalFiles] = useState<File[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const chatMessagesRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const N8N_ENDPOINT =
    "https://n8n-c2lq.onrender.com/webhook/66f3ee04-7d9b-4ae4-9e13-0af7a4cdde77/chat?action=sendMessage"
  const OPENAI_API_KEY = process.env.NEXT_PUBLIC_OPENAI_API_KEY || ""
  const PINECONE_HOST = process.env.NEXT_PUBLIC_PINECONE_HOST || ""
  const PINECONE_API_KEY = process.env.NEXT_PUBLIC_PINECONE_API_KEY || ""
  const OPENAI_MODEL = process.env.NEXT_PUBLIC_OPENAI_MODEL || "text-embedding-3-large"

  const CURRENT_NAMESPACE = useRef("")

  // Initialize
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Generate or get namespace
      let ns = localStorage.getItem("Namespace")
      if (!ns) {
        ns = generateUUID()
        localStorage.setItem("Namespace", ns)
      }
      CURRENT_NAMESPACE.current = ns

      // Load memory toggle
      const memoryState = localStorage.getItem("mike-ai-use-memory")
      setUseMemory(memoryState !== "false")

      // Load sidebar state
      const sidebarState = localStorage.getItem("mike-ai-sidebar-visible")
      setSidebarVisible(sidebarState !== "false")

      // Load chats
      const savedChats = JSON.parse(localStorage.getItem("mike-ai-chats") || "{}")
      setChats(savedChats)

      // Load or create current chat
      if (Object.keys(savedChats).length > 0) {
        const sortedChatIds = Object.keys(savedChats).sort((a, b) => savedChats[b].timestamp - savedChats[a].timestamp)
        const lastChatId = sortedChatIds[0]
        setCurrentChatId(lastChatId)
        setMessages(savedChats[lastChatId].messages || [])
        localStorage.setItem("mike-ai-session-id", lastChatId)
      } else {
        createNewChat()
      }
    }
  }, [])

  // Auto-scroll messages
  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight
    }
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px"
    }
  }, [inputValue])

  function generateUUID() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0,
        v = c === "x" ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  function generateSessionId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  function createNewChat() {
    const newChatId = generateSessionId()
    setCurrentChatId(newChatId)
    localStorage.setItem("mike-ai-session-id", newChatId)
    const initialMessage = {
      sender: "ai",
      text: "Ciao! Sono Mike AI, un esperto di marketing digitale. Il mio obiettivo principale è guidare l'azienda nella creazione di una strategia di marketing digitale personalizzata per generare lead qualificati e aumentare le vendite, partendo dall'analisi di buyer personas e utilizzando il modello Digital Strategy Framework inventato da Luca Papa. Vuoi che ti aiuti a creare una strategia di digital marketing per ottenere un aumento da 2X a 5X nel corso di un anno?",
      time: "Ora",
    }
    setMessages([initialMessage])
    setInputValue("")
    setPendingFiles([])
    saveChat(newChatId, [initialMessage], "Nuova Chat")
  }

  function saveChat(chatId: string, msgs: any[], title?: string) {
    const chatTitle =
      title || chats[chatId]?.title || msgs.find((m) => m.sender === "ai")?.text?.substring(0, 30) || "Nuova Chat"
    const timestamp = Date.now()
    const updatedChats = { ...chats, [chatId]: { title: chatTitle, messages: msgs, timestamp } }
    setChats(updatedChats)
    if (typeof window !== "undefined") {
      localStorage.setItem("mike-ai-chats", JSON.stringify(updatedChats))
    }
  }

  function loadChat(chatId: string) {
    if (!chats[chatId]) return
    setCurrentChatId(chatId)
    setMessages(chats[chatId].messages || [])
    if (typeof window !== "undefined") {
      localStorage.setItem("mike-ai-session-id", chatId)
    }
  }

  function deleteChat(chatId: string) {
    if (confirm("Sei sicuro di voler eliminare questa chat?")) {
      const updatedChats = { ...chats }
      delete updatedChats[chatId]
      setChats(updatedChats)
      if (typeof window !== "undefined") {
        localStorage.setItem("mike-ai-chats", JSON.stringify(updatedChats))
      }
      if (chatId === currentChatId) {
        createNewChat()
      }
    }
  }

  async function embedBatch(texts: string[]) {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ model: OPENAI_MODEL, input: texts }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(`OpenAI embeddings failed: ${res.status}`)
    return data.data.map((d: any) => d.embedding)
  }

  async function upsertVectors(vectors: any[]) {
    const url = `${PINECONE_HOST.replace(/\/+$/, "")}/vectors/upsert`
    const res = await fetch(url, {
      method: "POST",
      headers: { "Api-Key": PINECONE_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ namespace: CURRENT_NAMESPACE.current, vectors }),
    })
    if (!res.ok) throw new Error(`Pinecone upsert failed: ${res.status}`)
    return await res.json()
  }

  function cleanText(s: string) {
    return (s || "")
      .replace(/\u0000/g, "")
      .replace(/\r/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  function splitSentences(t: string) {
    return t.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú0-9(])/g)
  }

  function chunkSmart(text: string, size = 1000, overlap = 200): string[] {
    text = cleanText(text)
    const paras = text
      .split(/\n{2,}/g)
      .map((p) => p.trim())
      .filter(Boolean)
    const chunks: string[] = []
    let cur = ""
    const flush = () => {
      const s = cur.trim()
      if (s) chunks.push(s)
      cur = ""
    }
    for (const p of paras) {
      if ((cur + (cur ? "\n\n" : "") + p).length <= size) {
        cur += (cur ? "\n\n" : "") + p
      } else if (p.length <= size) {
        flush()
        cur = p
        flush()
      } else {
        for (const s of splitSentences(p)) {
          const t = (cur ? cur + " " : "") + s.trim()
          if (t.length <= size) cur = t
          else {
            flush()
            cur = s.trim()
          }
        }
        flush()
      }
    }
    flush()
    if (overlap > 0 && chunks.length > 1) {
      const out: string[] = [chunks[0]]
      for (let i = 1; i < chunks.length; i++) {
        const tail = out[out.length - 1].slice(-overlap)
        out.push((tail + "\n" + chunks[i]).slice(0, size + overlap))
      }
      return out
    }
    return chunks
  }

  async function fileToText(file: File): Promise<string> {
    const ab = await file.arrayBuffer()
    const ext = file.name.split(".").pop()?.toLowerCase() || ""
    try {
      console.log("[v0] Processing file:", file.name, "Extension:", ext)

      if (ext === "pdf") return await parsePDF(ab)
      if (ext === "docx") return await parseDOCX(ab)
      if (ext === "xlsx" || ext === "xls") return await parseXLSX(ab)
      if (ext === "csv") return parseCSV(new TextDecoder().decode(ab))

      // For text files, decode the content
      const textContent = cleanText(new TextDecoder().decode(ab))
      console.log("[v0] Decoded text content length:", textContent.length)
      return textContent
    } catch (err) {
      console.error(`Parsing failed for ${file.name}:`, err)
      return ""
    }
  }

  async function parsePDF(buf: ArrayBuffer): Promise<string> {
    try {
      const pdfjsLib = await import("pdfjs-dist")

      // Use unpkg CDN for worker to avoid bundling issues
      if (typeof window !== "undefined" && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`
      }

      const loadingTask = pdfjsLib.getDocument({ data: buf })
      const pdf = await loadingTask.promise
      let fullText = ""

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const textContent = await page.getTextContent()
        const pageText = textContent.items.map((item: any) => item.str).join(" ")
        fullText += pageText + "\n\n"
      }

      console.log("[v0] PDF parsed successfully, text length:", fullText.length)
      return cleanText(fullText)
    } catch (error) {
      console.error("[v0] PDF parsing error:", error)
      return ""
    }
  }

  async function parseDOCX(buf: ArrayBuffer): Promise<string> {
    try {
      const mammoth = await import("mammoth")
      const result = await mammoth.extractRawText({ arrayBuffer: buf })
      console.log("[v0] DOCX parsed successfully, text length:", result.value.length)
      return cleanText(result.value)
    } catch (error) {
      console.error("[v0] DOCX parsing error:", error)
      return ""
    }
  }

  async function parseXLSX(buf: ArrayBuffer): Promise<string> {
    try {
      const XLSX = await import("xlsx")
      const workbook = XLSX.read(buf, { type: "array" })
      let allText = ""

      workbook.SheetNames.forEach((sheetName: string) => {
        const sheet = workbook.Sheets[sheetName]
        const csv = XLSX.utils.sheet_to_csv(sheet)
        allText += `Sheet: ${sheetName}\n${csv}\n\n`
      })

      console.log("[v0] XLSX parsed successfully, text length:", allText.length)
      return cleanText(allText)
    } catch (error) {
      console.error("[v0] XLSX parsing error:", error)
      return ""
    }
  }

  function parseCSV(text: string): string {
    return cleanText(text)
  }

  async function indexFilesToPinecone(files: File[]) {
    console.log("[v0] Starting to index files to Pinecone:", files.length)

    const nowIso = new Date().toISOString()
    const all: Array<{
      id: string
      text: string
      metadata: {
        text: string
        file_name: string
        doc_id: string
        chunk_index: number
        source: string
        size_bytes: number
        uploaded_at: string
        app: string
        chat_id: string
      }
    }> = []

    for (const f of files) {
      console.log("[v0] Processing file:", f.name)
      const text = await fileToText(f)
      console.log("[v0] Extracted text length:", text.length)

      if (!text.trim()) {
        console.log("[v0] No text content found in file, skipping")
        continue
      }

      const chunks = chunkSmart(text, 1000, 200)
      console.log("[v0] Created chunks:", chunks.length)

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
            source: f.type || f.name.split(".").pop() || "",
            size_bytes: f.size || 0,
            uploaded_at: nowIso,
            app: "MikeAI-Uploader",
            chat_id: currentChatId,
          },
        }),
      )
    }

    console.log("[v0] Total chunks to upsert:", all.length)

    if (!all.length) {
      console.log("[v0] No chunks to upsert, returning")
      return
    }

    for (let i = 0; i < all.length; i += 100) {
      const batch = all.slice(i, i + 100)
      console.log("[v0] Processing batch:", i, "to", i + batch.length)

      const embs = await embedBatch(batch.map((d) => d.text))
      console.log("[v0] Generated embeddings for batch:", embs.length)

      const vecs = batch.map((d, idx) => ({ id: d.id, values: embs[idx], metadata: d.metadata }))
      await upsertVectors(vecs)
      console.log("[v0] Upserted batch to Pinecone")
    }

    console.log("[v0] Finished indexing all files to Pinecone")
  }

  async function upsertMessageToPinecone(message: string, sender: string) {
    try {
      const sessionId =
        typeof window !== "undefined"
          ? localStorage.getItem("mike-ai-session-id") || generateSessionId()
          : generateSessionId()
      const nowIso = new Date().toISOString()
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      const embeddings = await embedBatch([message])
      if (!embeddings || !embeddings[0] || !Array.isArray(embeddings[0])) {
        throw new Error("Failed to generate embedding")
      }

      const vector = {
        id: messageId,
        values: embeddings[0],
        metadata: {
          text: message,
          sender: sender,
          session_id: sessionId,
          chat_id: currentChatId,
          timestamp: nowIso,
          source: "mike-ai-chat-message",
          app: "MikeAI",
        },
      }
      await upsertVectors([vector])
      return true
    } catch (error) {
      console.error(`Failed to upsert ${sender} message:`, error)
      return false
    }
  }

  async function sendMessage() {
    const message = inputValue.trim()
    if (!message && pendingFiles.length === 0) return

    setIsSending(true)

    // Add user message
    const userMessage = {
      sender: "user",
      text: message || "📎 Allegati",
      time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      attachments: pendingFiles.length > 0 ? pendingFiles.map((f) => ({ name: f.name })) : undefined,
      status: pendingFiles.length > 0 ? "Indicizzazione allegati in corso…" : undefined,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInputValue("")
    saveChat(currentChatId, updatedMessages)

    // Upsert user message
    if (message) await upsertMessageToPinecone(message, "user")

    // Index attachments
    if (pendingFiles.length > 0) {
      try {
        await indexFilesToPinecone(pendingFiles)
        userMessage.status = "Indicizzazione completata ✅"
        setMessages([...updatedMessages])
        await upsertMessageToPinecone(
          `[Utente ha caricato ${pendingFiles.length} file: ${pendingFiles.map((f) => f.name).join(", ")}]`,
          "user",
        )
      } catch (e) {
        userMessage.status = "Errore indicizzazione ❌"
        setMessages([...updatedMessages])
        console.error("Attachment indexing error:", e)
      }
      setPendingFiles([])
    }

    // Add AI thinking message
    const thinkingMessage = { sender: "ai", text: "", time: "", isThinking: true }
    const withThinking = [...updatedMessages, thinkingMessage]
    setMessages(withThinking)

    try {
      const sessionId =
        typeof window !== "undefined"
          ? localStorage.getItem("mike-ai-session-id") || generateSessionId()
          : generateSessionId()

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
          useMemory: useMemory,
          metadata: {
            source: "mike-ai-chat",
            attachments: pendingFiles.length > 0,
            namespace: CURRENT_NAMESPACE.current,
          },
        }),
      })

      if (!res.ok) throw new Error("HTTP error " + res.status)

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No reader")

      const decoder = new TextDecoder("utf-8")
      let buffer = ""
      let rawText = ""
      let streamMode: string | null = null
      let generatedTitle: string | null = null

      const handleEvent = (jsonStr: string) => {
        let obj
        try {
          obj = JSON.parse(jsonStr)
        } catch {
          return
        }
        if (obj.type === "item" && typeof obj.content === "string") {
          rawText += obj.content
          const aiMessage = {
            sender: "ai",
            text: rawText,
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            isThinking: false,
          }
          const finalMessages = [...updatedMessages, aiMessage]
          setMessages(finalMessages)
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
            if (dataLines.length === 0) continue
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

      if (!rawText) {
        rawText = "Mi dispiace, non ho ricevuto una risposta valida. Riprova per favore."
      }

      const aiMessage = {
        sender: "ai",
        text: rawText,
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      }
      const finalMessages = [...updatedMessages, aiMessage]
      setMessages(finalMessages)

      if (rawText.trim()) {
        await upsertMessageToPinecone(rawText, "ai")
      }

      saveChat(currentChatId, finalMessages, generatedTitle || undefined)
    } catch (err) {
      console.error("Error:", err)
      const errorMessage = {
        sender: "ai",
        text: "Errore di connessione. Riprova più tardi.",
        time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
      }
      const finalMessages = [...updatedMessages, errorMessage]
      setMessages(finalMessages)
    } finally {
      setIsSending(false)
    }
  }

  function formatMessageText(text: string) {
    let t = (text || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    t = t.replace(/\*(.+?)\*/g, "<em>$1</em>")
    t = t.replace(/`([^`]+?)`/g, '<code class="inline-code">$1</code>')
    t = t.replace(
      /\[([^\]]+?)\]\$\$(https?:\/\/[^\s)]+?)\$\$/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    t = t.replace(/\n/g, "<br>")
    return t
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if ((inputValue.trim() || pendingFiles.length > 0) && !isSending) {
        sendMessage()
      }
    }
  }

  return (
    <>
      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        
        :root {
          --background: #ffffff;
          --foreground: #475569;
          --card: #ffffff;
          --card-foreground: #334155;
          --primary: #235E84;
          --primary-foreground: #ffffff;
          --secondary: #E3F2FD;
          --secondary-foreground: #235E84;
          --muted: #f8fafc;
          --muted-foreground: #64748b;
          --accent: #235E84;
          --accent-foreground: #ffffff;
          --sidebar: #ffffff;
          --sidebar-foreground: #475569;
          --sidebar-primary: #E3F2FD;
          --sidebar-primary-foreground: #235E84;
          --sidebar-accent: #235E84;
          --sidebar-accent-foreground: #ffffff;
          --sidebar-border: #e2e8f0;
          --border: #e2e8f0;
          --input: #ffffff;
          --radius: 12px;
        }

        .mike-chat-widget {
          width: 100%;
          height: 800px;
          max-width: none;
          margin: 0;
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          position: relative;
          overflow: hidden;
          border-radius: var(--radius);
          box-shadow: 0 20px 25px -5px rgba(0,0,0,.1), 0 10px 10px -5px rgba(0,0,0,.04);
          background: var(--background);
          border: 3px solid #235E84;
          min-width: 900px;
        }

        .app-container {
          background: var(--background);
          width: 100%;
          height: 100%;
          display: flex;
          overflow: hidden;
          position: relative;
          min-width: 900px;
        }

        .sidebar {
          width: 320px;
          min-width: 320px;
          background: var(--sidebar);
          border-right: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
          transition: all .3s cubic-bezier(.4,0,.2,1);
          position: relative;
        }

        .sidebar.hidden {
          width: 0;
          min-width: 0;
          overflow: hidden;
          border-right: none;
        }

        .sidebar-header {
          padding: 20px;
          border-bottom: 1px solid var(--sidebar-border);
          background: var(--sidebar);
          color: var(--sidebar-foreground);
        }

        .brand-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 24px;
        }

        .brand-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .brand-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: var(--sidebar-foreground);
        }

        .profile-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          overflow: hidden;
          background: var(--primary);
        }

        .profile-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .new-chat-button {
          background: var(--primary);
          border: none;
          color: var(--primary-foreground);
          padding: 14px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all .2s ease;
          width: 100%;
        }

        .new-chat-button:hover {
          background: var(--accent);
          transform: translateY(-1px);
        }

        .memory-toggle-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 0 0 0;
          font-size: 14px;
          font-weight: 500;
          color: var(--sidebar-foreground);
        }

        .switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          inset: 0;
          background-color: #ccc;
          transition: .4s;
          border-radius: 24px;
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .4s;
          border-radius: 50%;
        }

        input:checked + .slider {
          background-color: var(--primary);
        }

        input:checked + .slider:before {
          transform: translateX(20px);
        }

        .sidebar-split-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          overflow: hidden;
        }

        .chat-list-wrapper {
          flex: 1 1 50%;
          overflow-y: auto;
          padding: 16px 20px;
          min-height: 100px;
        }

        .chat-item {
          padding: 16px;
          border-radius: 8px;
          cursor: pointer;
          transition: all .2s ease;
          margin-bottom: 2px;
          border: none;
          background: transparent;
          position: relative;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chat-item:hover {
          background: var(--sidebar-primary);
        }

        .chat-item.active {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }

        .chat-item-content {
          flex: 1;
        }

        .chat-item-title {
          font-weight: 500;
          font-size: 14px;
          color: var(--sidebar-foreground);
          margin-bottom: 4px;
        }

        .chat-item-subtitle {
          font-size: 12px;
          color: var(--muted-foreground);
        }

        .delete-chat-btn {
          opacity: 0;
          background: #ef4444;
          border: none;
          color: white;
          width: 24px;
          height: 24px;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .2s ease;
          font-size: 12px;
        }

        .chat-item:hover .delete-chat-btn {
          opacity: 1;
        }

        .delete-chat-btn:hover {
          background: #dc2626;
        }

        .agents-section {
          flex: 1 1 50%;
          min-height: 150px;
          margin-top: 0;
          padding: 16px 20px;
          padding-top: 16px;
          border-top: 1px solid var(--sidebar-border);
          display: flex;
          flex-direction: column;
        }

        .agents-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 16px;
          font-weight: 600;
          color: var(--sidebar-foreground);
          margin-bottom: 16px;
          padding: 0 4px;
          flex-shrink: 0;
        }

        .agents-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .agent-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--sidebar-foreground);
          transition: background-color .2s ease;
        }

        .agent-item:hover {
          background-color: var(--sidebar-primary);
        }

        .agent-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--muted);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          flex-shrink: 0;
          color: var(--muted-foreground);
        }

        .agent-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .agent-name {
          font-size: 14px;
          font-weight: 500;
        }

        .chat-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          background: var(--background);
          position: relative;
        }

        .chat-header {
          background: #235E84;
          color: #ffffff;
          padding: 20px 40px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          min-height: 80px;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        /* Add styles for home button */
        .home-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 8px;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.2);
          color: #ffffff;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          transition: all .2s ease;
        }

        .home-button:hover {
          background: rgba(255,255,255,.2);
          transform: translateY(-1px);
        }

        /* Add styles for header right section */
        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toggle-sidebar-btn {
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.2);
          padding: 10px;
          border-radius: 8px;
          cursor: pointer;
          color: #ffffff;
          transition: all .2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .toggle-sidebar-btn:hover {
          background: rgba(255,255,255,.2);
        }

        .chat-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 50px 80px;
          background: var(--background);
          min-height: 0;
        }

        .message {
          margin-bottom: 32px;
          display: flex;
          align-items: flex-start;
          gap: 20px;
          animation: fadeInUp .4s cubic-bezier(.4,0,.2,1);
          max-width: 90%;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .message.user {
          flex-direction: row-reverse;
          margin-left: auto;
        }

        .message-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 14px;
          flex-shrink: 0;
          overflow: hidden;
        }

        .message-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .message.ai .message-avatar {
          background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
          color: var(--primary-foreground);
        }

        .message.user .message-avatar {
          background: var(--secondary);
          color: var(--secondary-foreground);
        }

        .message-content {
          flex: 1;
          background: #ffffff;
          padding: 20px 24px;
          border-radius: var(--radius);
          border: 1px solid var(--border);
          box-shadow: none;
          min-width: 200px;
        }

        .message.user .message-content {
          background: #235E84;
          color: #ffffff;
          border-color: #235E84;
        }

        .message-text {
          color: var(--card-foreground);
          line-height: 1.6;
          font-size: 15px;
        }

        .message.user .message-text {
          color: #ffffff;
        }

        .message-time {
          font-size: 12px;
          color: var(--muted-foreground);
          margin-top: 8px;
        }

        .message.user .message-time {
          color: rgba(255,255,255,.7);
        }

        .thinking-dots {
          display: flex;
          align-items: center;
          gap: 5px;
        }

        .thinking-dots .dot {
          width: 8px;
          height: 8px;
          background-color: var(--muted-foreground);
          border-radius: 50%;
          animation: typing 1.4s infinite ease-in-out both;
        }

        .thinking-dots .dot:nth-child(2) {
          animation-delay: .2s;
        }

        .thinking-dots .dot:nth-child(3) {
          animation-delay: .4s;
        }

        @keyframes typing {
          0%, 60%, 100% { transform: translateY(0); opacity: .4; }
          30% { transform: translateY(-10px); opacity: 1; }
        }

        .attachment-list {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .attachment-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          background: var(--muted);
          color: var(--card-foreground);
          border: 1px solid var(--sidebar-border);
        }

        .message.user .attachment-pill {
          background: rgba(255,255,255,.15);
          color: #fff;
          border-color: rgba(255,255,255,.25);
        }

        .attach-status {
          font-size: 12px;
          margin-top: 8px;
          opacity: .8;
        }

        .input-container {
          padding: 30px 80px;
          border-top: 1px solid var(--border);
          background: var(--background);
        }

        .input-wrapper {
          display: flex;
          align-items: flex-end;
          gap: 12px;
          background: var(--input);
          border: 2px solid var(--border);
          border-radius: var(--radius);
          padding: 12px 16px;
          transition: all .2s ease;
        }

        .input-wrapper:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(35,94,132,.1);
        }

        .message-input {
          flex: 1;
          border: none;
          outline: none;
          background: transparent;
          font-size: 15px;
          color: var(--foreground);
          resize: none;
          min-height: 24px;
          max-height: 120px;
          font-family: inherit;
        }

        .message-input::placeholder {
          color: var(--muted-foreground);
        }

        .attach-button {
          position: relative;
          background: transparent;
          border: 2px solid var(--border);
          color: var(--foreground);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
          transition: all .2s ease;
        }

        .attach-button:hover {
          background: var(--secondary);
          border-color: var(--primary);
          color: var(--secondary-foreground);
          transform: scale(1.05);
        }

        .attach-badge {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: #ef4444;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: none;
          align-items: center;
          justify-content: center;
        }

        .attach-button.has-items .attach-badge {
          display: flex;
        }

        .send-button {
          background: var(--primary);
          border: none;
          color: var(--primary-foreground);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all .2s ease;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          background: var(--accent);
          transform: scale(1.05);
        }

        .send-button:disabled {
          background: var(--muted);
          color: var(--muted-foreground);
          cursor: not-allowed;
        }

        .pc-modal {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.45);
          display: none;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .pc-modal.open {
          display: flex;
        }

        .pc-card {
          width: min(980px, 95vw);
          background: #0f172a;
          color: #e5e7eb;
          border-radius: 14px;
          border: 2px solid #235E84;
          box-shadow: 0 20px 60px rgba(0,0,0,.45);
          overflow: hidden;
        }

        .pc-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 14px 16px;
          background: #235E84;
          color: #fff;
          font-weight: 700;
        }

        .pc-body {
          padding: 16px;
        }

        .pc-drop {
          border: 2px dashed #334155;
          border-radius: 14px;
          padding: 18px;
          text-align: center;
          background: #111827;
        }

        .pc-drop.drag {
          border-color: #93c5fd;
          background: #0b1220;
        }

        .pc-files {
          margin-top: 10px;
        }

        .pc-filepill {
          display: inline-block;
          margin: 4px 6px 0 0;
          padding: 4px 8px;
          border-radius: 999px;
          border: 1px solid #334155;
          background: #0b1220;
          font-size: 12px;
        }

        .pc-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }

        .pc-btn {
          background: #235E84;
          color: #fff;
          border: 0;
          padding: 10px 14px;
          border-radius: 8px;
          font-weight: 700;
          cursor: pointer;
        }

        .pc-btn:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        .pc-pill {
          background: #0b1220;
          border: 1px solid #334155;
          color: #e5e7eb;
          padding: 4px 8px;
          border-radius: 999px;
          font-size: 12px;
        }

        .pc-close {
          background: rgba(255,255,255,.15);
          color: #fff;
          border: 1px solid rgba(255,255,255,.25);
          padding: 8px 10px;
          border-radius: 8px;
          cursor: pointer;
        }

        /* Adding responsive design for mobile and tablet */
        /* Hamburger menu button - visible only on mobile */
        .mobile-menu-btn {
          display: none;
          background: rgba(255,255,255,.1);
          border: 1px solid rgba(255,255,255,.2);
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          color: #ffffff;
          transition: all .2s ease;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
        }

        .mobile-menu-btn:hover {
          background: rgba(255,255,255,.2);
        }

        /* Close button for mobile sidebar */
        .mobile-close-btn {
          display: none;
          position: absolute;
          top: 20px;
          right: 20px;
          background: rgba(35,94,132,.1);
          border: 1px solid var(--sidebar-border);
          padding: 8px;
          border-radius: 8px;
          cursor: pointer;
          color: var(--sidebar-foreground);
          transition: all .2s ease;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          z-index: 10;
        }

        .mobile-close-btn:hover {
          background: rgba(35,94,132,.2);
        }

        /* Backdrop for mobile sidebar */
        .sidebar-backdrop {
          display: none;
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,.5);
          z-index: 999;
        }

        @media (max-width: 1024px) {
          .mike-chat-widget {
            min-width: auto;
            height: 700px;
          }

          .app-container {
            min-width: auto;
          }

          .sidebar {
            width: 280px;
            min-width: 280px;
          }

          .chat-header {
            padding: 16px 30px;
            min-height: 70px;
          }

          .chat-messages {
            padding: 30px 50px;
          }

          .input-container {
            padding: 20px 50px;
          }
        }

        @media (max-width: 768px) {
          .mike-chat-widget {
            height: 100vh;
            border-radius: 0;
            border: none;
          }

          .app-container {
            min-width: auto;
          }

          .sidebar {
            width: 280px;
            min-width: 280px;
            position: fixed;
            left: -280px;
            top: 0;
            height: 100%;
            z-index: 1000;
            transition: left .3s cubic-bezier(.4,0,.2,1);
            box-shadow: 2px 0 20px rgba(0,0,0,.2);
          }

          .sidebar.open {
            left: 0;
          }

          .sidebar.open ~ .sidebar-backdrop {
            display: block;
          }

          .mobile-close-btn {
            display: flex;
          }

          .mobile-menu-btn {
            display: flex;
          }

          .toggle-sidebar-btn {
            display: none;
          }

          .chat-header {
            padding: 12px 16px;
            min-height: 60px;
          }

          .chat-title {
            font-size: 16px;
          }

          .home-button {
            padding: 6px 12px;
            font-size: 13px;
          }

          .chat-messages {
            padding: 16px;
          }

          .input-container {
            padding: 12px 16px;
          }

          .message {
            max-width: 95%;
            gap: 12px;
          }

          .message-avatar {
            width: 32px;
            height: 32px;
            font-size: 12px;
          }

          .message-content {
            padding: 12px 16px;
          }

          .message-text {
            font-size: 14px;
          }

          .sidebar-header {
            padding: 16px;
          }

          .brand-title {
            font-size: 18px;
          }

          .profile-avatar {
            width: 36px;
            height: 36px;
          }

          .new-chat-button {
            padding: 12px 16px;
            font-size: 13px;
          }

          .chat-list-wrapper {
            padding: 12px 16px;
          }

          .agents-section {
            padding: 12px 16px;
          }
        }

        @media (max-width: 480px) {
          .chat-header {
            padding: 10px 12px;
            min-height: 56px;
          }

          .chat-title {
            font-size: 14px;
          }

          .home-button span {
            display: none;
          }

          .home-button {
            padding: 6px;
          }

          .chat-messages {
            padding: 12px;
          }

          .input-container {
            padding: 10px 12px;
          }

          .message {
            gap: 10px;
          }

          .message-avatar {
            width: 28px;
            height: 28px;
          }

          .message-content {
            padding: 10px 12px;
          }

          .message-text {
            font-size: 13px;
          }

          .input-wrapper {
            padding: 8px 12px;
          }

          .attach-button, .send-button {
            width: 36px;
            height: 36px;
          }
        }

        @media (max-width: 360px) {
          .sidebar {
            width: 260px;
            min-width: 260px;
            left: -260px;
          }

          .brand-title {
            font-size: 16px;
          }

          .profile-avatar {
            width: 32px;
            height: 32px;
          }

          .message-text {
            font-size: 12px;
          }
        }
      `}</style>

      <div className="mike-chat-widget">
        <div className="app-container">
          <div className={`sidebar ${sidebarVisible ? "open" : ""}`}>
            <button
              className="mobile-close-btn"
              onClick={() => {
                setSidebarVisible(false)
                if (typeof window !== "undefined") {
                  localStorage.setItem("mike-ai-sidebar-visible", "false")
                }
              }}
              title="Chiudi menu"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>

            <div className="sidebar-header">
              <div className="brand-header">
                <div className="brand-section">
                  <div className="profile-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png"
                      alt="Mike AI"
                    />
                  </div>
                  <div className="brand-title">Mike AI</div>
                </div>
              </div>
              <button className="new-chat-button" onClick={createNewChat}>
                <span>+</span> Nuova Chat
              </button>
              <div className="memory-toggle-container">
                <label htmlFor="memoryToggle">Usa Memoria</label>
                <label className="switch">
                  <input
                    type="checkbox"
                    id="memoryToggle"
                    checked={useMemory}
                    onChange={(e) => {
                      setUseMemory(e.target.checked)
                      if (typeof window !== "undefined") {
                        localStorage.setItem("mike-ai-use-memory", String(e.target.checked))
                      }
                    }}
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>

            <div className="sidebar-split-content">
              <div className="chat-list-wrapper">
                <div className="chat-list">
                  {Object.keys(chats)
                    .sort((a, b) => chats[b].timestamp - chats[a].timestamp)
                    .map((chatId) => (
                      <div
                        key={chatId}
                        className={`chat-item ${chatId === currentChatId ? "active" : ""}`}
                        onClick={() => loadChat(chatId)}
                      >
                        <div className="chat-item-content">
                          <div className="chat-item-title">{chats[chatId].title || "Nuova Chat"}</div>
                          <div className="chat-item-subtitle">
                            {new Date(chats[chatId].timestamp).toLocaleString("it-IT", {
                              day: "numeric",
                              month: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        <button
                          className="delete-chat-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteChat(chatId)
                          }}
                          title="Elimina chat"
                        >
                          ✖
                        </button>
                      </div>
                    ))}
                </div>
              </div>

              <div className="agents-section">
                <h3 className="agents-title">AGENTI AI:</h3>
                <div className="agents-list">
                  {[
                    {
                      name: "Tony AI",
                      url: "https://members.digital-coach.com/products/tony-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Tony-AI-strategiest.png",
                    },
                    {
                      name: "Aladino AI",
                      url: "https://members.digital-coach.com/products/aladdin-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Aladdin-AI-consultant.png",
                    },
                    {
                      name: "Lara AI",
                      url: "https://members.digital-coach.com/products/lara-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Lara-AI-social-strategiest.png",
                    },
                    {
                      name: "Simone AI",
                      url: "https://members.digital-coach.com/products/simone-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Simone-AI-seo-copy.png",
                    },
                    {
                      name: "Mike AI",
                      url: "https://members.digital-coach.com/products/mike-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png",
                    },
                    {
                      name: "Valentina AI",
                      url: "https://members.digital-coach.com/products/valentina-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/03/Valentina-AI-AI-SEO-optimizer.png",
                    },
                    {
                      name: "Niko AI",
                      url: "https://members.digital-coach.com/products/niko-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Niko-AI.png",
                    },
                    {
                      name: "Jim AI",
                      url: "https://members.digital-coach.com/products/jim-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/02/Jim-AI-%E2%80%93-AI-Coach.png",
                    },
                    {
                      name: "Daniele AI",
                      url: "https://members.digital-coach.com/products/daniele-ai",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2024/11/Gary-AI-SMMg-icon.png",
                    },
                    {
                      name: "Alex AI",
                      url: "https://members.digital-coach.com/products/alex-ai-2-0",
                      img: "https://www.ai-scaleup.com/wp-content/uploads/2025/03/David-AI-Ai-Specialist-social-ads.png",
                    },
                  ].map((agent, idx) => (
                    <a key={idx} href={agent.url} target="_blank" rel="noopener noreferrer" className="agent-item">
                      <div className="agent-avatar">
                        <img src={agent.img || "/placeholder.svg"} alt={agent.name} />
                      </div>
                      <span className="agent-name">{agent.name}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {sidebarVisible && (
            <div
              className="sidebar-backdrop"
              onClick={() => {
                setSidebarVisible(false)
                if (typeof window !== "undefined") {
                  localStorage.setItem("mike-ai-sidebar-visible", "false")
                }
              }}
            />
          )}

          <div className="chat-container">
            <div className="chat-header">
              <div className="header-left">
                <button
                  className="mobile-menu-btn"
                  onClick={() => {
                    setSidebarVisible(true)
                    if (typeof window !== "undefined") {
                      localStorage.setItem("mike-ai-sidebar-visible", "true")
                    }
                  }}
                  title="Mostra menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                  </svg>
                </button>

                <button
                  className="toggle-sidebar-btn"
                  onClick={() => {
                    setSidebarVisible(!sidebarVisible)
                    if (typeof window !== "undefined") {
                      localStorage.setItem("mike-ai-sidebar-visible", String(!sidebarVisible))
                    }
                  }}
                  title="Mostra/Nascondi conversazioni"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    {sidebarVisible ? (
                      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                    ) : (
                      <path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12z" />
                    )}
                  </svg>
                </button>
                <div className="chat-title">Mike AI - Direttore Marketing</div>
              </div>
              <div className="header-right">
                <Link href="/" className="home-button">
                  <Home className="h-5 w-5" />
                  <span>Home</span>
                </Link>
                <UserButton
                  appearance={{
                    elements: {
                      avatarBox: "size-8 rounded-lg",
                    },
                  }}
                />
              </div>
            </div>

            <div className="chat-messages" ref={chatMessagesRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.sender}`}>
                  <div className="message-avatar">
                    <img
                      src="https://www.ai-scaleup.com/wp-content/uploads/2025/02/Mike-AI-digital-marketing-mg.png"
                      alt={msg.sender === "user" ? "User" : "Mike AI"}
                    />
                  </div>
                  <div className="message-content">
                    <div className="message-text">
                      {msg.isThinking ? (
                        <div className="thinking-dots">
                          <div className="dot"></div>
                          <div className="dot"></div>
                          <div className="dot"></div>
                        </div>
                      ) : (
                        <span dangerouslySetInnerHTML={{ __html: formatMessageText(msg.text) }} />
                      )}
                    </div>
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="attachment-list">
                        {msg.attachments.map((att: any, i: number) => (
                          <span key={i} className="attachment-pill">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M16.5 6.5l-7.78 7.78a3 3 0 104.24 4.24l7.78-7.78a5 5 0 10-7.07-7.07L5.1 10.24a7 7 0 109.9 9.9l6.36-6.36-1.41-1.41-6.36 6.36a5 5 0 11-7.07-7.07l8.48-8.49a3 3 0 114.24 4.25l-7.79 7.78a1 1 0 01-1.41-1.41L15.09 8" />
                            </svg>
                            <span>{att.name}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {msg.status && <div className="attach-status">{msg.status}</div>}
                    {!msg.isThinking && <div className="message-time">{msg.time}</div>}
                  </div>
                </div>
              ))}
            </div>

            <div className="input-container">
              <div className="input-wrapper">
                <button
                  className={`attach-button ${pendingFiles.length > 0 ? "has-items" : ""}`}
                  onClick={() => setIsModalOpen(true)}
                  type="button"
                  title="Carica documenti"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                    <path d="M16.5 6.5l-7.78 7.78a3 3 0 104.24 4.24l7.78-7.78a5 5 0 10-7.07-7.07L5.1 10.24a7 7 0 109.9 9.9l6.36-6.36-1.41-1.41-6.36 6.36a5 5 0 11-7.07-7.07l8.48-8.49a3 3 0 114.24 4.25l-7.79 7.78a1 1 0 01-1.41-1.41L15.09 8" />
                  </svg>
                  <span className="attach-badge">{pendingFiles.length}</span>
                </button>

                <textarea
                  ref={textareaRef}
                  className="message-input"
                  placeholder="Scrivi la tua domanda per Mike..."
                  rows={1}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={isSending}
                />

                <button
                  className="send-button"
                  onClick={sendMessage}
                  disabled={(!inputValue.trim() && pendingFiles.length === 0) || isSending}
                  type="button"
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
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className={`pc-modal ${isModalOpen ? "open" : ""}`} onClick={() => setIsModalOpen(false)}>
          <div className="pc-card" onClick={(e) => e.stopPropagation()}>
            <div className="pc-head">
              <div>Seleziona i file da allegare alla chat</div>
              <button className="pc-close" onClick={() => setIsModalOpen(false)}>
                Chiudi ✕
              </button>
            </div>
            <div className="pc-body">
              <div
                className={`pc-drop ${isDragging ? "drag" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault()
                  setIsDragging(true)
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setIsDragging(false)
                  const files = Array.from(e.dataTransfer.files)
                  setModalFiles([...modalFiles, ...files])
                }}
              >
                <strong>Trascina qui i file</strong> oppure{" "}
                <label htmlFor="pcFile" style={{ textDecoration: "underline", cursor: "pointer", color: "#93c5fd" }}>
                  sfoglia
                </label>
                <input
                  id="pcFile"
                  type="file"
                  multiple
                  accept=".pdf,.docx,.txt,.md,.csv,.xlsx,.xls"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    setModalFiles([...modalFiles, ...files])
                  }}
                />
                <div className="pc-files">
                  {modalFiles.map((f, i) => (
                    <span key={i} className="pc-filepill">
                      {f.name}
                    </span>
                  ))}
                </div>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 6 }}>PDF, DOCX, TXT/MD, CSV, XLS/XLSX</div>
              </div>

              <div className="pc-row">
                <button
                  className="pc-btn"
                  onClick={() => {
                    setPendingFiles([...pendingFiles, ...modalFiles])
                    setModalFiles([])
                    setIsModalOpen(false)
                  }}
                  disabled={modalFiles.length === 0}
                >
                  Allega alla chat
                </button>
                <span className="pc-pill">
                  {modalFiles.length > 0 ? `${modalFiles.length} file selezionati` : "nessun file"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
