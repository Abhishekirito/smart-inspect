import { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  X, Send, Bot, Trash2,
  Minimize2, Maximize2, Mic, MicOff, FileText, Square,
} from 'lucide-react'
import { useSettings } from '../context/SettingsContext.jsx'
import { streamGroqChat } from '../lib/chatService.js'
import { getScan } from '../lib/db.js'
import { useAppBack, hideKeyboard } from '../lib/native.js'
import { ChatTurn } from './ChatMessage.jsx'

export default function ChatWidget({ activeScanReport = null }) {
  const { settings } = useSettings()
  const location = useLocation()
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [input, setInput] = useState('')
  const [dynamicScanContext, setDynamicScanContext] = useState(activeScanReport)

  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### 🤖 Smart Inspect Legal Co-Pilot\nWelcome! I am your AI assistant specialized in **Legal Metrology (Packaged Commodities) Rules, 2011**.\n\nAsk me anything about mandatory declarations, Rule 7 font sizes, exemption rules, or scan report analysis!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState(null)
  const [isListening, setIsListening] = useState(false)

  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const abortControllerRef = useRef(null)

  const hasGroqKey = !!(settings.groqKey || import.meta.env.VITE_GROQ_API_KEY)
  const activeModel = settings.groqModel || import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile'

  // The full-page workspace at /app/assistant is the same assistant — showing
  // the floating bubble on top of it would be redundant.
  const isAssistantPage = location.pathname.startsWith('/app/assistant')

  useEffect(() => {
    if (isAssistantPage) setIsOpen(false)
  }, [isAssistantPage])

  // Detect active report context from URL
  useEffect(() => {
    if (activeScanReport) {
      setDynamicScanContext(activeScanReport)
      return
    }

    if (location.pathname.startsWith('/app/report/')) {
      const scanId = location.pathname.split('/app/report/')[1]
      if (scanId) {
        getScan(scanId).then((scan) => {
          if (scan) {
            setDynamicScanContext({
              product_name: scan.productName,
              overall_status: scan.report?.overall_status,
              grade: scan.report?.grade,
              evaluations: scan.report?.field_results,
              extracted: scan.structured,
              data: scan
            })
          }
        }).catch(() => {})
      }
    } else {
      setDynamicScanContext(null)
    }
  }, [location.pathname, activeScanReport])

  // Scroll to bottom on new message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, isOpen, isStreaming])

  // Escape collapses the expanded view first, then closes the drawer
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return
      if (isExpanded) setIsExpanded(false)
      else setIsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, isExpanded])

  // Android's back button does the same, one layer at a time, so it dismisses
  // the chat instead of leaving the page behind it.
  useAppBack(() => {
    if (!isOpen) return false
    if (isExpanded) setIsExpanded(false)
    else setIsOpen(false)
    return true
  }, isOpen)

  // Focus the composer when the drawer opens (skip on touch so the mobile
  // keyboard does not slide up unrequested)
  useEffect(() => {
    if (!isOpen) return
    if (window.matchMedia('(min-width: 640px)').matches) {
      inputRef.current?.focus()
    }
  }, [isOpen])

  // Speech Recognition setup (Voice search)
  const toggleSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech Recognition is not supported by your browser. Please type your message.')
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = 'en-IN'

      recognition.onstart = () => setIsListening(true)
      recognition.onend = () => setIsListening(false)
      recognition.onerror = () => setIsListening(false)

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        if (transcript) {
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
        }
      }

      recognition.start()
    } catch (e) {
      setIsListening(false)
    }
  }

  const handleSend = async (textToSend = null) => {
    const userPrompt = (textToSend || input).trim()
    if (!userPrompt || isStreaming) return

    setInput('')
    // On Android the IME stays up after submit and covers the streaming reply.
    hideKeyboard()
    const userMsgId = Date.now().toString()
    const userMsg = {
      id: userMsgId,
      role: 'user',
      content: userPrompt,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)

    // Prepare assistant streaming message. `content` holds the reply and
    // nothing else; reasoning and service notices live in their own fields.
    const botMsgId = (Date.now() + 1).toString()
    const botMsg = {
      id: botMsgId,
      role: 'assistant',
      content: '',
      reasoning: '',
      notice: '',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages((prev) => [...prev, botMsg])
    setIsStreaming(true)
    setStreamingId(botMsgId)

    abortControllerRef.current = new AbortController()

    const patchBotMsg = (patch) =>
      setMessages((prev) => prev.map((m) => (m.id === botMsgId ? { ...m, ...patch } : m)))

    try {
      let accumulatedText = ''
      let accumulatedReasoning = ''
      await streamGroqChat({
        messages: updatedMessages.filter((m) => m.id !== 'welcome'),
        scanContext: dynamicScanContext,
        settings,
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          accumulatedText += chunk
          patchBotMsg({ content: accumulatedText })
        },
        onReasoning: (chunk) => {
          accumulatedReasoning += chunk
          patchBotMsg({ reasoning: accumulatedReasoning })
        },
        onNotice: (notice) => patchBotMsg({ notice }),
        onError: (err) => patchBotMsg({ notice: err.message }),
      })
    } catch (e) {
      // Handled in onError
    } finally {
      setIsStreaming(false)
      setStreamingId(null)
    }
  }

  const handleStop = () => {
    abortControllerRef.current?.abort()
    setIsStreaming(false)
    setStreamingId(null)
  }

  const handleClear = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    setIsStreaming(false)
    setStreamingId(null)
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `### 🤖 Smart Inspect Legal Co-Pilot\nConversation cleared. How can I assist you with Legal Metrology rules today?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])
  }

  // Quick Prompt Options
  const quickPrompts = dynamicScanContext
    ? [
        { label: '❓ Why did this fail?', prompt: 'Analyze the current scan report and explain why it passed or failed specific PCR 2011 rules.' },
        { label: '📜 Draft Legal Notice', prompt: 'Draft an official non-compliance notice for the manufacturer based on this scan report.' },
        { label: '📐 Font Size Check', prompt: 'Explain the Rule 7 font size requirements for this product PDP area.' },
      ]
    : [
        { label: '📜 Rule 6 Declarations', prompt: 'What are all mandatory declarations required under Rule 6 of PCR 2011?' },
        { label: '📐 Rule 7 Font Sizes', prompt: 'Show the minimum numeral height table under Rule 7 for different package sizes.' },
        { label: '🔍 Rule 26 Exemptions', prompt: 'What packages are exempt from declarations under Rule 26?' },
        { label: '⚖️ Rule 13 Units', prompt: 'What are standard units of weight and measure allowed under Rule 13?' },
      ]

  // Full-bleed sheet on phones, floating card from `sm` upwards.
  const shellPosition = isExpanded
    ? 'inset-0 sm:inset-4 lg:inset-8'
    : 'inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[min(660px,calc(100dvh-2.5rem))] sm:w-[400px] lg:w-[440px]'

  if (isAssistantPage) return null

  return (
    <>
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="chat-fab group fixed right-4 z-40 flex items-center gap-2.5 rounded-full bg-slate-900 px-3.5 py-3 text-white shadow-2xl transition hover:scale-105 hover:bg-brand-700 active:scale-95 sm:right-5 sm:px-5 sm:py-3.5"
          title="Open AI Legal Assistant"
          aria-label="Open AI Legal Assistant"
        >
          <div className="relative flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white">
            <Bot size={18} />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400 ring-2 ring-slate-900" />
          </div>
          <span className="hidden text-sm font-semibold tracking-wide sm:inline">AI Assistant</span>
          <span className="hidden rounded-full border border-brand-400/30 bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-300 md:inline">
            Groq
          </span>
        </button>
      )}

      {/* Floating Chat Window Drawer */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="AI Legal Assistant"
          className={`fixed z-50 flex flex-col overflow-hidden border-slate-200 bg-white shadow-2xl transition-all duration-300 sm:rounded-2xl sm:border ${shellPosition}`}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 bg-slate-900 px-3 py-3 text-white sm:px-4 sm:py-3.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow">
                <Bot size={20} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold">Smart Inspect Co-Pilot</span>
                  <span className="hidden shrink-0 rounded bg-brand-800/80 px-1.5 py-0.5 text-[10px] font-medium text-brand-200 sm:inline">
                    Groq AI
                  </span>
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {dynamicScanContext ? `Linked: ${dynamicScanContext.product_name || 'Current Report'}` : 'PCR 2011 Legal Expert'}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={handleClear}
                title="Clear Chat"
                aria-label="Clear chat"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <Trash2 size={16} />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? 'Restore size' : 'Maximize'}
                aria-label={isExpanded ? 'Restore size' : 'Maximize'}
                className="hidden rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white sm:block"
              >
                {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                title="Close"
                aria-label="Close assistant"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Active Context Banner */}
          {dynamicScanContext && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-brand-100 bg-brand-50 px-3.5 py-2 text-xs text-brand-900">
              <div className="flex min-w-0 items-center gap-1.5 truncate">
                <FileText size={14} className="shrink-0 text-brand-600" />
                <span className="hidden shrink-0 font-semibold sm:inline">Active Context:</span>
                <span className="truncate font-medium text-brand-700">
                  {dynamicScanContext.product_name || 'Scan Report'} ({dynamicScanContext.overall_status || 'Report'})
                </span>
              </div>
              <span className="shrink-0 rounded bg-brand-200 px-1.5 py-0.5 text-[10px] font-bold text-brand-800">
                Score: {dynamicScanContext.grade?.score ?? 'N/A'}
              </span>
            </div>
          )}

          {/* Messages Area */}
          <div className="flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50/50 p-3 sm:p-4">
            {messages.map((m) => (
              <ChatTurn key={m.id} message={m} isStreaming={streamingId === m.id} compact />
            ))}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar */}
          <div className="no-scrollbar flex shrink-0 gap-1.5 overflow-x-auto whitespace-nowrap border-t border-slate-100 bg-white px-3 py-2">
            {quickPrompts.map((qp, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(qp.prompt)}
                disabled={isStreaming}
                className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                {qp.label}
              </button>
            ))}
          </div>

          {/* Input Area */}
          <div className="pb-safe shrink-0 border-t border-slate-200 bg-white p-3">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                handleSend()
              }}
              className="flex items-center gap-2"
            >
              <button
                type="button"
                onClick={toggleSpeechRecognition}
                className={`shrink-0 rounded-xl p-2.5 transition ${
                  isListening
                    ? 'animate-pulse bg-red-500 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title={isListening ? 'Listening...' : 'Voice query'}
                aria-label={isListening ? 'Stop listening' : 'Start voice query'}
              >
                {isListening ? <MicOff size={18} /> : <Mic size={18} />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? 'Listening...' : 'Ask about PCR 2011...'}
                disabled={isStreaming}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base text-slate-800 placeholder-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 sm:text-sm"
              />

              {isStreaming ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="btn shrink-0 !rounded-xl !p-2.5 bg-red-50 text-red-600 hover:bg-red-100"
                  title="Stop generating"
                  aria-label="Stop generating"
                >
                  <Square size={18} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="btn-primary shrink-0 !rounded-xl !p-2.5 disabled:cursor-not-allowed disabled:opacity-40"
                  title="Send message"
                  aria-label="Send message"
                >
                  <Send size={18} />
                </button>
              )}
            </form>

            <div className="mt-2 flex items-center justify-between gap-2 px-1 text-[10px] text-slate-400">
              <span className="truncate">{hasGroqKey ? `Model: ${activeModel}` : 'Demo mode (Add Groq API key in Settings)'}</span>
              {/* Standing disclaimer, so replies do not have to carry their own */}
              <span className="hidden shrink-0 sm:inline">Verify against the official Gazette</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
