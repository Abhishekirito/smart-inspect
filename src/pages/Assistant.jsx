import { useState, useRef, useEffect } from 'react'
import {
  Bot, Send, Sparkles, Trash2, ShieldCheck,
  FileText, BookOpen, AlertTriangle, Scale, Mic, MicOff, HelpCircle,
  Square, ChevronDown,
} from 'lucide-react'
import { useSettings } from '../context/SettingsContext.jsx'
import { streamGroqChat } from '../lib/chatService.js'
import { ChatTurn } from '../components/ChatMessage.jsx'
import { hideKeyboard } from '../lib/native.js'

export default function Assistant() {
  const { settings } = useSettings()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `### ⚖️ Smart Inspect Legal Metrology Workspace\nWelcome to your full-page legal co-pilot! Powered by **Groq AI**, I am trained on the **Legal Metrology (Packaged Commodities) Rules, 2011 (PCR 2011)**.\n\nUse this workspace to search legal clauses, draft official violation notices, check font size requirements, or audit complex product packaging scenarios.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamingId, setStreamingId] = useState(null)
  const [isListening, setIsListening] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)

  const messagesEndRef = useRef(null)
  const abortControllerRef = useRef(null)

  const hasGroqKey = !!(settings.groqKey || import.meta.env.VITE_GROQ_API_KEY)
  const activeModel = settings.groqModel || import.meta.env.VITE_GROQ_MODEL || 'llama-3.3-70b-versatile'

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isStreaming])

  const toggleSpeech = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in your browser.')
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

  const handleSend = async (customPrompt = null) => {
    const promptText = (customPrompt || input).trim()
    if (!promptText || isStreaming) return

    setInput('')
    setShowLibrary(false)
    // On Android the IME stays up after submit and covers the streaming reply.
    hideKeyboard()
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const updated = [...messages, userMsg]
    setMessages(updated)

    // `content` holds the reply and nothing else; reasoning and service notices
    // live in their own fields so a copy of the reply stays clean.
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
      let accumulated = ''
      let accumulatedReasoning = ''
      await streamGroqChat({
        messages: updated.filter((m) => m.id !== 'welcome'),
        settings,
        signal: abortControllerRef.current.signal,
        onChunk: (chunk) => {
          accumulated += chunk
          patchBotMsg({ content: accumulated })
        },
        onReasoning: (chunk) => {
          accumulatedReasoning += chunk
          patchBotMsg({ reasoning: accumulatedReasoning })
        },
        onNotice: (notice) => patchBotMsg({ notice }),
        onError: (err) => patchBotMsg({ notice: err.message }),
      })
    } catch (e) {
      //
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
    if (abortControllerRef.current) abortControllerRef.current.abort()
    setIsStreaming(false)
    setStreamingId(null)
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `### ⚖️ Workspace Cleared\nReady for new Legal Metrology queries. Choose a template from the prompt library or type your query below.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ])
  }

  const promptLibrary = [
    {
      title: 'Mandatory Declarations Check',
      category: 'Rule 6',
      icon: BookOpen,
      prompt: 'List all mandatory declarations required under Rule 6 of PCR 2011 with exact clause citations and format rules.'
    },
    {
      title: 'Font Size & PDP Height Table',
      category: 'Rule 7',
      icon: Scale,
      prompt: 'Detail the mandatory font size requirements under Rule 7 and Schedules I & II based on Principal Display Panel area.'
    },
    {
      title: 'Draft Non-Compliance Notice',
      category: 'Legal Notice',
      icon: FileText,
      prompt: 'Draft an official Legal Violation Memorandum to a manufacturer under Section 18 of LM Act 2009 for missing MRP and customer care email.'
    },
    {
      title: 'Exemption Rules & Exclusions',
      category: 'Rule 26 & Rule 3',
      icon: AlertTriangle,
      prompt: 'Explain what packages are exempt under Rule 26 and which consumer packaging scenarios are excluded under Rule 3.'
    },
    {
      title: 'Standard Units & Banned Words',
      category: 'Rule 13',
      icon: HelpCircle,
      prompt: 'What are the standard units of net quantity allowed under Rule 13, and what non-standard unit abbreviations (e.g. gms, grm) are banned?'
    }
  ]

  return (
    <div className="flex flex-col gap-4 lg:h-[calc(100dvh-8rem)] lg:flex-row lg:gap-6">
      {/* Main Chat Workspace */}
      <div className="flex h-[calc(100dvh-13rem)] min-h-[440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:h-auto lg:min-h-0 lg:flex-1">
        {/* Workspace Header */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-slate-900 px-4 py-3 text-white sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-600 text-white shadow">
              <Bot size={22} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-sm font-extrabold tracking-tight sm:text-base">
                  AI Legal Assistant
                  <span className="hidden sm:inline"> Workspace</span>
                </h1>
                <span className="hidden shrink-0 rounded-md border border-brand-400/30 bg-brand-500/20 px-2 py-0.5 text-xs font-semibold text-brand-300 sm:inline">
                  Groq LLM
                </span>
              </div>
              <p className="truncate text-xs text-slate-400">Legal Metrology (Packaged Commodities) Rules, 2011</p>
            </div>
          </div>

          <button
            onClick={handleClear}
            className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 transition hover:bg-slate-700 hover:text-white sm:px-3"
            title="Clear chat"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Clear Chat</span>
          </button>
        </div>

        {/* Message Stream */}
        <div className="flex-1 space-y-5 overflow-y-auto overscroll-contain bg-slate-50/50 p-4 sm:space-y-6 sm:p-6">
          {messages.map((m) => (
            <ChatTurn key={m.id} message={m} isStreaming={streamingId === m.id} />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="pb-safe shrink-0 border-t border-slate-200 bg-white p-3 sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSend()
            }}
            className="flex items-center gap-2 sm:gap-3"
          >
            <button
              type="button"
              onClick={toggleSpeech}
              className={`shrink-0 rounded-xl p-2.5 transition sm:p-3 ${
                isListening
                  ? 'animate-pulse bg-red-500 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              title={isListening ? 'Listening...' : 'Voice Query'}
              aria-label={isListening ? 'Stop listening' : 'Start voice query'}
            >
              {isListening ? <MicOff size={20} /> : <Mic size={20} />}
            </button>

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Ask about PCR 2011, font sizes, or draft legal notices...'}
              disabled={isStreaming}
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder-slate-400 transition focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 sm:px-4 sm:py-3 sm:text-sm"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={handleStop}
                className="btn shrink-0 !rounded-xl bg-red-50 !px-3.5 !py-3 text-red-600 hover:bg-red-100 sm:!px-5"
                title="Stop generating"
              >
                <Square size={18} />
                <span className="hidden sm:inline">Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="btn-primary shrink-0 !rounded-xl !px-3.5 !py-3 disabled:opacity-40 sm:!px-5"
              >
                <Send size={18} />
                <span className="hidden sm:inline">Send Query</span>
              </button>
            )}
          </form>
          <div className="mt-2 flex items-center justify-between gap-2 px-1 text-xs text-slate-400">
            <span className="truncate">
              {hasGroqKey ? `Model: ${activeModel}` : 'Demo mode — add a Groq API key in Settings'}
            </span>
            {/* Standing disclaimer, so replies do not have to carry their own */}
            <span className="shrink-0">AI output — verify against the official Gazette</span>
          </div>
        </div>
      </div>

      {/* Prompt Library & Quick Rules Reference — collapsible below lg */}
      <div className="flex w-full shrink-0 flex-col gap-4 lg:w-80 lg:overflow-y-auto">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <button
            type="button"
            onClick={() => setShowLibrary((v) => !v)}
            aria-expanded={showLibrary}
            className="flex w-full items-center gap-2 text-left lg:pointer-events-none lg:mb-3"
          >
            <Sparkles size={16} className="shrink-0 text-brand-600" />
            <h2 className="flex-1 text-sm font-bold text-slate-900">Prompt Library</h2>
            <ChevronDown
              size={18}
              className={`shrink-0 text-slate-400 transition-transform lg:hidden ${showLibrary ? 'rotate-180' : ''}`}
            />
          </button>

          <div className={`${showLibrary ? 'block' : 'hidden'} lg:block`}>
            <p className="mb-4 mt-3 text-xs leading-relaxed text-slate-500 lg:mt-0">
              Click any legal prompt below to execute an instant query with the Groq AI engine.
            </p>
            <div className="space-y-2.5">
              {promptLibrary.map((item, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(item.prompt)}
                  disabled={isStreaming}
                  className="group w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-brand-300 hover:bg-brand-50 disabled:opacity-50"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs font-bold text-slate-800 group-hover:text-brand-700">
                    <span className="min-w-0 truncate">{item.title}</span>
                    <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 group-hover:bg-brand-200 group-hover:text-brand-800">
                      {item.category}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-[11px] text-slate-500">{item.prompt}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm sm:p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold">
            <ShieldCheck size={18} className="shrink-0 text-emerald-400" />
            PCR 2011 Quick Reference
          </h3>
          <ul className="space-y-2 text-xs leading-relaxed text-slate-300">
            <li><strong className="text-white">Rule 6:</strong> 7 mandatory declarations on all packages.</li>
            <li><strong className="text-white">Rule 7:</strong> Height of numerals based on PDP surface area.</li>
            <li><strong className="text-white">Rule 13:</strong> Banned non-standard units (e.g. gms, grm).</li>
            <li><strong className="text-white">Rule 26:</strong> Exemption for packs ≤ 10g or 10ml.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
