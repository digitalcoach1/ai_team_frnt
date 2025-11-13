"use client"

import { useEffect, useRef } from "react"

const N8N_URL = "https://n8n-c2lq.onrender.com/webhook/4e27c666-aa21-4d92-b78a-34229167245b/chat"
const AVATAR = "https://www.ai-scaleup.com/wp-content/uploads/2025/03/Giulia-Ai-Team.jpeg"

export default function GiuliaWidget() {
  const chatBubbleRef = useRef<HTMLDivElement>(null)
  const chatWindowRef = useRef<HTMLDivElement>(null)
  const closeBtnRef = useRef<HTMLButtonElement>(null)
  const sendBtnRef = useRef<HTMLButtonElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const chatMessagesRef = useRef<HTMLDivElement>(null)

  // ——— helpers copied from your script ———
  const sanitizeText = (text: string) =>
    text
      .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "") // remove invisible chars
      .replace(/[^\S\r\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim()

  const addMessage = (text: string, sender: "ai" | "user") => {
    if (!chatMessagesRef.current) return null

    const msg = document.createElement("div")
    msg.className = `message ${sender}`

    const avatar = document.createElement("div")
    avatar.className = "message-avatar"
    avatar.innerHTML = `<img src="${
      sender === "ai"
        ? AVATAR
        : "https://www.shutterstock.com/image-vector/vector-flat-illustration-grayscale-avatar-600nw-2264922221.jpg"
    }" alt="${sender === "ai" ? "Giulia" : "User"}">`

    const content = document.createElement("div")
    content.className = "message-content"

    const cleanText = sanitizeText(text)
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\\n/g, "<br>")
      .replace(/\n/g, "<br>")

    content.innerHTML = cleanText

    msg.appendChild(avatar)
    msg.appendChild(content)
    chatMessagesRef.current.appendChild(msg)
    chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight

    return content
  }

  const toggleOpen = (open: boolean) => {
    if (!chatWindowRef.current) return
    chatWindowRef.current.classList.toggle("open", open)
  }

  // ——— send logic converted to React ———
  const sendMessage = async () => {
    const input = chatInputRef.current
    const messages = chatMessagesRef.current
    if (!input || !messages) return

    const text = input.value.trim()
    if (!text) return

    addMessage(text, "user")
    input.value = ""

    const aiMsg = addMessage("", "ai")
    if (aiMsg) {
      aiMsg.innerHTML = `
        <div class="thinking-dots">
          <div class="dot"></div><div class="dot"></div><div class="dot"></div>
        </div>`
      messages.scrollTop = messages.scrollHeight
    }

    try {
      const sessionId = localStorage.getItem("giulia-session") || `giulia-${Date.now()}`
      localStorage.setItem("giulia-session", sessionId)

      const res = await fetch(N8N_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatInput: text, sessionId, agent: "Giulia" }),
      })

      const textData = await res.text()
      // console.log('Giulia raw response:', textData);

      const extracted: string[] = []
      try {
        const regex = /"content"\s*:\s*"([^"]*?)"/g
        let match: RegExpExecArray | null
        while ((match = regex.exec(textData)) !== null) {
          if (match[1] && match[1].trim()) extracted.push(match[1])
        }
      } catch {
        /* ignore */
      }

      let finalText = sanitizeText(extracted.join(" ").trim())
      if (!finalText) {
        try {
          const parsed = JSON.parse(textData)
          finalText = sanitizeText(parsed.reply || parsed.message || parsed.text || "(nessuna risposta ricevuta)")
        } catch {
          finalText = "(nessuna risposta ricevuta)"
        }
      }

      if (aiMsg) {
        aiMsg.innerHTML = finalText
          .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
          .replace(/\\n/g, "<br>")
          .replace(/\n/g, "<br>")
      }
    } catch (err) {
      if (aiMsg) aiMsg.textContent = "Errore di connessione. Riprova più tardi."
    }
  }

  // Wire up listeners
  useEffect(() => {
    // open on mount and print first message
    toggleOpen(true)
    addMessage("Ciao 👋 Sono Giulia, la tua AI Team Tutor! Come posso aiutarti?", "ai")

    const bubble = chatBubbleRef.current
    const close = closeBtnRef.current
    const send = sendBtnRef.current
    const input = chatInputRef.current

    const onBubble = () => toggleOpen(true)
    const onClose = () => toggleOpen(false)
    const onSend = () => sendMessage()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        sendMessage()
      }
    }

    bubble?.addEventListener("click", onBubble)
    close?.addEventListener("click", onClose)
    send?.addEventListener("click", onSend)
    input?.addEventListener("keydown", onKey)

    return () => {
      bubble?.removeEventListener("click", onBubble)
      close?.removeEventListener("click", onClose)
      send?.removeEventListener("click", onSend)
      input?.removeEventListener("keydown", onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Render the widget DOM
  return (
    <>
      <div className="giulia-widget-container">
        <div className="giulia-chat-bubble" ref={chatBubbleRef} aria-label="Apri chat Giulia">
          <img src={AVATAR || "/placeholder.svg"} alt="Giulia" />
        </div>

        <div className="giulia-chat-window" ref={chatWindowRef} role="dialog" aria-label="Chat Giulia">
          <div className="chat-header">
            <div className="header-left">
              <div className="header-avatar">
                <img src={AVATAR || "/placeholder.svg"} alt="Giulia" />
              </div>
              <div className="chat-title">Giulia, AI Team Tutor</div>
            </div>
            <button className="giulia-close-btn" ref={closeBtnRef} aria-label="Chiudi">
              ×
            </button>
          </div>

          <div className="chat-messages" ref={chatMessagesRef} />

          <div className="input-container">
            <input className="message-input" ref={chatInputRef} placeholder="Scrivi la tua domanda..." />
            <button className="send-button" ref={sendBtnRef} aria-label="Invia">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        /* All styles are now scoped to .giulia-widget-container */
        .giulia-widget-container {
          font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          font-size: 14px;
          line-height: 1.5;
        }

        /* Floating bubble */
        .giulia-chat-bubble {
          position: fixed;
          bottom: 25px;
          right: 25px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #fff;
          overflow: hidden;
          cursor: pointer;
          z-index: 9999;
          transition: 0.3s;
          border: 6px solid #b52636;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .giulia-chat-bubble img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          border-radius: 50%;
          background: #fff;
        }
        .giulia-chat-bubble:hover {
          transform: scale(1.1);
          background: #fff;
        }

        /* Chat window */
        .giulia-chat-window {
          position: fixed;
          bottom: 100px;
          right: 25px;
          width: 400px;
          height: 600px;
          max-height: calc(100vh - 120px);
          background: #fff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
          display: none;
          flex-direction: column;
          overflow: hidden;
          z-index: 10000;
        }
        .giulia-chat-window.open {
          display: flex;
        }

        .chat-header {
          background: #b52636;
          color: #fff;
          height: 55px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .header-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
          background: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .header-avatar img {
          width: 90%;
          height: 90%;
          border-radius: 50%;
          object-fit: cover;
        }
        .chat-title {
          font-weight: 600;
          font-size: 16px;
        }

        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f8fafc;
        }

        .chat-messages :global(.message) {
          margin-bottom: 16px;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .chat-messages :global(.message.user) {
          flex-direction: row-reverse;
        }
        .chat-messages :global(.message-avatar) {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background: #fff;
          border: 1px solid #ddd;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-messages :global(.message-avatar img) {
          width: 90%;
          height: 90%;
          object-fit: cover;
          border-radius: 50%;
        }

        .chat-messages :global(.message-content) {
          max-width: 80%;
          background: #f1f5f9;
          padding: 10px 14px;
          border-radius: 12px;
          display: inline-block;
          white-space: normal;
          overflow-wrap: break-word;
          word-break: normal;
          hyphens: none;
          text-align: left;
          line-height: 1.6;
          letter-spacing: 0.02em;
          font-variant-ligatures: none;
          font-kerning: none;
          font-feature-settings: 'kern' 0, 'liga' 0, 'clig' 0, 'calt' 0;
          text-rendering: optimizeSpeed;
        }
        .chat-messages :global(.message-content *) {
          word-break: normal !important;
          overflow-wrap: break-word !important;
          white-space: normal !important;
          hyphens: none !important;
        }

        .chat-messages :global(.message.user .message-content) {
          background: #b52636;
          color: #fff;
        }

        .input-container {
          padding: 12px 16px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          gap: 10px;
          align-items: center;
          background: #fff;
        }
        .message-input {
          flex: 1;
          border: 1px solid #e2e8f0;
          border-radius: 50px;
          padding: 8px 14px;
          font-size: 14px;
          outline: none;
          font-family: inherit;
        }
        .send-button {
          background: #b52636;
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex-shrink: 0;
        }
        .send-button:hover {
          background: #c82a3a;
        }

        .chat-messages :global(.thinking-dots) {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .chat-messages :global(.dot) {
          width: 6px;
          height: 6px;
          background: #999;
          border-radius: 50%;
          animation: blink 1.2s infinite;
        }
        .chat-messages :global(.dot:nth-child(2)) {
          animation-delay: 0.2s;
        }
        .chat-messages :global(.dot:nth-child(3)) {
          animation-delay: 0.4s;
        }
        @keyframes blink {
          0%,
          80%,
          100% {
            opacity: 0.2;
          }
          40% {
            opacity: 1;
          }
        }

        .giulia-close-btn {
          background: none;
          border: none;
          color: #fff;
          font-size: 24px;
          cursor: pointer;
          line-height: 1;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .giulia-close-btn:hover {
          opacity: 0.8;
        }

        @media (max-width: 450px) {
          .giulia-chat-window {
            width: 100vw;
            height: 100vh;
            bottom: 0;
            right: 0;
            border-radius: 0;
            max-height: 100vh;
          }
        }
      `}</style>
    </>
  )
}
