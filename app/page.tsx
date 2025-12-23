
"use client"

import * as React from "react"
import { Send, User, Image as ImageIcon, Video, Pencil, MessageSquare, Plus, Menu, Trash2, X, Copy, ThumbsUp, ThumbsDown, RotateCw, MoreHorizontal, ChevronDown, Database, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import Image from "next/image"
import sennaLogo from "./assets/senna.png"
import { SplashLogo } from "@/components/SplashLogo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from "framer-motion"

// --- Types ---

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface ChatSession {
  id: string
  title: string
  messages: Message[]
  lastModified: number
}

// --- Main Component ---

export default function Home() {
  // State
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null)
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false) // Mobile/Desktop toggle

  // Context / Knowledge Base State
  const [isContextModalOpen, setIsContextModalOpen] = React.useState(false)
  const [ingestStatus, setIngestStatus] = React.useState<{ status: 'idle' | 'processing' | 'completed' | 'error', message?: string, progress?: number, startTime?: number }>({ status: 'idle', progress: 0 })
  const [elapsedTime, setElapsedTime] = React.useState<string>("00:00")
  const [contextUrls, setContextUrls] = React.useState([
    'https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship',
    'https://www.formula1.com/en/teams.html'
  ].join('\n'))
  const [showSplash, setShowSplash] = React.useState(true) // Start with Splash

  const scrollRef = React.useRef<HTMLDivElement>(null)

  // --- Helpers ---

  const scrollToBottom = () => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      }
    }
  }

  // Generate a title from the first message
  const generateTitle = (firstMessage: string) => {
    return firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "")
  }

  // --- Effects ---

  // Load from LocalStorage
  React.useEffect(() => {
    const saved = localStorage.getItem('chat_sessions')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        // Convert timestamp strings back to Date objects
        const hydrated = parsed.map((s: ChatSession) => ({
          ...s,
          messages: s.messages.map((m: Message) => ({ ...m, timestamp: new Date(m.timestamp) }))
        }))
        setSessions(hydrated)
      } catch (e) {
        console.error("Failed to load history", e)
      }
    }
  }, [])

  // Save to LocalStorage
  React.useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem('chat_sessions', JSON.stringify(sessions))
    }
  }, [sessions])

  React.useEffect(() => {
    scrollToBottom()
  }, [sessions, currentSessionId])

  // Poll Ingest Status
  React.useEffect(() => {


    const checkStatus = async () => {
      try {
        const res = await fetch('/api/ingest/status')
        const data = await res.json()

        // Only update if state changed to avoid re-renders (simplified check)
        setIngestStatus(prev => {
          if (prev.status !== data.status || prev.message !== data.message) {
            return data
          }
          return prev
        })

        if (data.status === 'processing' && data.startTime) {
          const seconds = Math.floor((Date.now() - data.startTime) / 1000)
          const m = Math.floor(seconds / 60).toString().padStart(2, '0')
          const s = (seconds % 60).toString().padStart(2, '0')
          setElapsedTime(`${m}:${s}`)
        }

        if (data.status === 'completed') {
          setIngestStatus(prev => ({ ...prev, progress: 100 }))
        }
      } catch (e) {
        console.error("Status check failed", e)
      }
    }

    // Check immediately on mount and then interval
    checkStatus()
    const interval = setInterval(checkStatus, 1000) // Update timer every second

    return () => clearInterval(interval)
  }, [])

  const startIngestion = async () => {
    setIngestStatus({ status: 'processing', message: 'Starting...' })
    setIsContextModalOpen(false) // Close modal
    try {
      await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: contextUrls.split('\n').filter(u => u.trim()) })
      })
      // Polling will pick up the rest
    } catch (e) {
      console.error(e)
      setIngestStatus({ status: 'error', message: 'Failed to start ingestion' })
    }
  }


  // --- Actions ---

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const startNewChat = () => {
    setCurrentSessionId(null)
    setInput('')
    setIsSidebarOpen(false) // Close sidebar on mobile
  }

  const deleteSession = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setSessions(prev => prev.filter(s => s.id !== id))
    if (currentSessionId === id) {
      setCurrentSessionId(null)
    }
  }

  const loadSession = (id: string) => {
    setCurrentSessionId(id)
    setIsSidebarOpen(false)
  }

  const sendMessage = async (e?: React.FormEvent, overrideInput?: string) => {
    if (e) e.preventDefault()

    // Use overrideInput if provided, otherwise fallback to state input
    const messageContent = overrideInput || input

    if (!messageContent.trim() || isLoading) return

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageContent,
      timestamp: new Date()
    }

    // Logic: If no current session, create one. If session exists, append.
    let sessionId = currentSessionId
    let updatedSessions = [...sessions]

    if (!sessionId) {
      sessionId = Date.now().toString()
      const newSession: ChatSession = {
        id: sessionId,
        title: generateTitle(messageContent),
        messages: [newMessage],
        lastModified: Date.now()
      }
      updatedSessions = [newSession, ...updatedSessions]
      setCurrentSessionId(sessionId)
    } else {
      updatedSessions = updatedSessions.map(s => {
        if (s.id === sessionId) {
          return {
            ...s,
            messages: [...s.messages, newMessage],
            lastModified: Date.now()
          }
        }
        return s
      })
      // Move updated session to top
      const currentSession = updatedSessions.find(s => s.id === sessionId)
      if (currentSession) {
        updatedSessions = [currentSession, ...updatedSessions.filter(s => s.id !== sessionId)]
      }
    }

    setSessions(updatedSessions)
    setInput('')
    setIsLoading(true)

    // Get context from current conversation
    const currentSessionMessages = updatedSessions.find(s => s.id === sessionId)?.messages || []

    // Create placeholder assistant message immediately
    const assistantMsgId = (Date.now() + 1).toString()
    const assistantMessagePlaceholder: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '', // Start empty
      timestamp: new Date()
    }

    // Add placeholder to state immediately
    setSessions(prev => prev.map(s => {
      if (s.id === sessionId) {
        return { ...s, messages: [...s.messages, assistantMessagePlaceholder] }
      }
      return s
    }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: currentSessionMessages.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      })

      if (!response.ok) throw new Error(response.statusText)

      // Stream reading logic
      const reader = response.body?.getReader()
      if (!reader) throw new Error("No reader available")

      const decoder = new TextDecoder()
      let accumulatedContent = ""

      let isFirstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        if (isFirstChunk) {
          setIsLoading(false)
          isFirstChunk = false
        }

        const text = decoder.decode(value, { stream: true })
        accumulatedContent += text

        // Update the specific message in the specific session
        setSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantMsgId
                  ? { ...m, content: accumulatedContent }
                  : m
              )
            }
          }
          return s
        }))
      }

    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 2).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your connection.',
        timestamp: new Date()
      }

      // If we failed mid-stream or before start, we might want to replace the empty placeholder or append error
      setSessions(prev => prev.map(s => {
        if (s.id === sessionId) {
          // If we have an empty placeholder, update it to error. otherwise append.
          const hasPlaceholder = s.messages.some(m => m.id === assistantMsgId && m.content === '')
          if (hasPlaceholder) {
            return {
              ...s,
              messages: s.messages.map(m =>
                m.id === assistantMsgId ? { ...errorMessage, id: assistantMsgId } : m
              )
            }
          }
          return { ...s, messages: [...s.messages, errorMessage] }
        }
        return s
      }))
    } finally {
      setIsLoading(false)
    }
  }

  // --- Render Props ---

  const currentSession = sessions.find(s => s.id === currentSessionId)
  const displayMessages = currentSession ? currentSession.messages : []
  const hasMessages = displayMessages.length > 0

  // Suggestion chips data
  const suggestions = [
    { icon: <ImageIcon className="w-4 h-4 text-yellow-400" />, label: "Show me the 2024 cars", action: "What do the 2024 F1 cars look like?" },
    { icon: <Video className="w-4 h-4 text-blue-400" />, label: "Best overtakes of 2023", action: "Tell me about the best overtakes of 2023" },
    { icon: <Pencil className="w-4 h-4 text-purple-400" />, label: "Write a poem about Senna", action: "Write a short poem about Ayrton Senna" },
  ]

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden">
      {/* Splash Screen Animation */}
      {showSplash && <SplashLogo onComplete={() => setShowSplash(false)} />}

      {/* --- Sidebar (History) --- */}
      <motion.div
        className={cn(
          "fixed md:relative z-20 h-full bg-zinc-900/50 backdrop-blur-xl border-r border-white/10 w-[280px] flex flex-col transition-all duration-300 transform",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0 md:w-[280px] w-0"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <button onClick={startNewChat} className="flex items-center gap-2 text-sm font-medium text-white/90 hover:text-white transition-colors bg-white/10 px-3 py-2 rounded-lg w-full">
            <Plus className="w-4 h-4" />
            New Chat
          </button>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-zinc-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <ScrollArea className="flex-1 p-2">
          <div className="space-y-1">
            <div className="px-2 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">History</div>
            <AnimatePresence>
              {sessions.map(session => (
                <motion.button
                  key={session.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => loadSession(session.id)}
                  className={cn(
                    "group flex items-center justify-between w-full text-left px-3 py-3 rounded-xl text-sm transition-all relative overflow-hidden",
                    currentSessionId === session.id
                      ? "bg-blue-500/20 text-blue-100"
                      : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                  )}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <MessageSquare className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <div
                    onClick={(e) => deleteSession(e, session.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/20 rounded-md transition-all absolute right-2"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </div>
                </motion.button>
              ))}
            </AnimatePresence>
            {sessions.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-600">
                No history yet. Start a chat!
              </div>
            )}

          </div>
        </ScrollArea>

        {/* Context Button */}
        <div className="p-4 border-t border-white/5">
          <button
            onClick={() => setIsContextModalOpen(true)}
            className={cn(
              "flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg transition-colors",
              ingestStatus.status === 'processing' ? "bg-blue-500/10 text-blue-400" : "text-zinc-400 hover:text-white hover:bg-white/5"
            )}
          >
            {ingestStatus.status === 'processing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                <div className="flex-1 flex flex-col items-start overflow-hidden">
                  <span className="text-xs font-medium truncate w-full flex justify-between">
                    <span>Updating...</span>
                    <span>{ingestStatus.progress || 0}%</span>
                  </span>
                  <div className="h-0.5 w-full bg-blue-500/20 mt-1.5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-blue-500"
                      initial={{ width: 0 }}
                      animate={{ width: `${ingestStatus.progress || 0}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <Database className="w-4 h-4" />
                <span>Knowledge Base</span>
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col h-full relative bg-gradient-to-br from-black via-zinc-950 to-zinc-900">

        {/* Desktop Header / Model Selector */}
        <div className="hidden md:flex items-center p-4 absolute top-0 left-0 z-30">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors text-zinc-300 hover:text-white">
            <span className="text-lg font-semibold text-white/90">F1 2025</span>
            <ChevronDown className="w-4 h-4 opacity-50" />
          </div>
        </div>

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-zinc-400">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm">F1 2025</span>
            <ChevronDown className="w-3 h-3 opacity-50" />
          </div>
          <div className="w-8" />
        </div>

        {/* Chat Area */}
        <AnimatePresence mode="wait">
          {!hasMessages ? (
            /* Empty State */
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex-1 flex flex-col items-center justify-center p-4 text-center space-y-8"
            >
              <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-2xl shadow-blue-500/20 overflow-hidden relative">
                  <Image src={sennaLogo} alt="Senna Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="text-4xl font-semibold tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white to-white/60">
                  Hello, Driver
                </h1>
                <div className="text-zinc-400/80 text-lg">
                  How can I help you today?
                </div>
              </div>
            </motion.div>
          ) : (
            /* Messages List */
            <ScrollArea ref={scrollRef} className="flex-1 p-4 md:p-8">
              <div className="space-y-6 pb-32 max-w-3xl mx-auto">
                {displayMessages.map((message) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={message.id}
                    className={cn(
                      "flex w-full gap-4",
                      message.role === 'user' ? "flex-row-reverse" : "flex-row"
                    )}
                  >
                    {/* Avatars */}
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-2 shadow-lg overflow-hidden relative",
                      message.role === 'user' ? "bg-zinc-800 hidden md:flex" : "hidden md:flex bg-gradient-to-tr from-blue-600 to-cyan-500"
                    )}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <Image src={sennaLogo} alt="AI" className="w-full h-full object-cover" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div className={cn(
                      "max-w-[85%] md:max-w-[75%] space-y-2",
                      message.role === 'user'
                        ? "bg-[#2f2f2f] text-white p-4 rounded-[1.5rem] rounded-tr-md shadow-sm"
                        : "px-1 text-zinc-100" // Transparent for assistant
                    )}>
                      {message.role === 'assistant' && (
                        <div className="font-semibold text-sm text-white/90 mb-1 ml-1">F1 AI</div>
                      )}

                      <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-zinc-900 prose-pre:p-4 prose-pre:rounded-lg max-w-none text-[0.95rem]">
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        )}
                      </div>

                      {/* Action Toolbar (Assistant Only) */}
                      {message.role === 'assistant' && !isLoading && (
                        <div className="flex items-center gap-1 mt-2 -ml-2">
                          <Button onClick={() => copyToClipboard(message.content)} variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                            <Copy className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                            <ThumbsUp className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                            <ThumbsDown className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                            <RotateCw className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex px-4 max-w-3xl mx-auto">
                    <div className="bg-zinc-800/50 rounded-2xl p-3 flex gap-1 items-center animate-pulse">
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </AnimatePresence>

        {/* Input Area */}
        <div className="w-full p-4 md:p-6 max-w-3xl mx-auto">
          <div className="relative">
            {/* Suggestions (only when empty and no messages) */}
            {!hasMessages && (
              <div className="absolute bottom-full left-0 w-full mb-6 py-2 overflow-x-auto flex gap-2 no-scrollbar justify-center flex-wrap">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(undefined, s.action)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800/60 hover:bg-zinc-700/80 backdrop-blur-md text-zinc-300 text-xs md:text-sm rounded-full border border-white/5 transition-all text-nowrap"
                  >
                    {s.icon}
                    <span>{s.label}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Input Bar */}
            <div className="bg-zinc-800/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-1.5 focus-within:bg-zinc-800/60 focus-within:border-white/20 transition-all shadow-2xl flex items-center gap-2">
              <div className="p-2">
                <Plus className="w-6 h-6 text-zinc-400 cursor-pointer hover:text-white transition-colors" /> {/* Apple-style attachment icon */}
              </div>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    sendMessage()
                  }
                }}
                placeholder="Message ChatBot..."
                className="flex-1 bg-transparent border-0 focus-visible:ring-0 text-white placeholder:text-zinc-500 text-[1rem] h-12 px-2 shadow-none"
                disabled={isLoading}
              />
              <Button
                onClick={() => sendMessage()}
                disabled={isLoading || !input.trim()}
                size="icon"
                className={cn(
                  "rounded-full w-10 h-10 transition-all duration-300",
                  input.trim() ? "bg-white hover:bg-zinc-200 text-black scale-100" : "bg-zinc-800 text-zinc-500 scale-90 opacity-0 md:opacity-100"
                )}
              >
                <Send className="w-4 h-4 ml-0.5" />
              </Button>
            </div>
            <div className="text-center mt-3 text-xs text-zinc-500 font-medium">
              ChatBot can make mistakes. Check important information.
            </div>
          </div>
        </div>



        {/* --- Context Modal --- */}
        <AnimatePresence>
          {isContextModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1c1c1e] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
              >
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-white">
                      <Database className="w-5 h-5 text-blue-500" />
                      <h2 className="text-lg font-semibold">Update Knowledge Base</h2>
                    </div>
                    <button onClick={() => setIsContextModalOpen(false)} className="text-zinc-500 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 flex gap-3">
                    <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-yellow-500/90 leading-relaxed">
                      <strong>Warning:</strong> This will delete the current database and scrape the new URLs. This happens in the background.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Source URLs</label>
                    <textarea
                      value={contextUrls}
                      onChange={(e) => setContextUrls(e.target.value)}
                      className="w-full h-40 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-zinc-300 focus:outline-none focus:border-blue-500/50 resize-none font-mono"
                      placeholder="https://..."
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button variant="ghost" onClick={() => setIsContextModalOpen(false)} className="text-zinc-400 hover:text-white">Cancel</Button>
                    <Button onClick={startIngestion} className="bg-blue-600 hover:bg-blue-500 text-white rounded-lg">
                      Start Update
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* --- Status Notification --- */}
        <AnimatePresence>
          {(ingestStatus.status === 'processing' || ingestStatus.status === 'completed' || ingestStatus.status === 'error') && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-6 right-6 z-50 max-w-sm w-full"
            >
              <div className={cn(
                "p-4 rounded-xl border shadow-2xl backdrop-blur-xl flex items-center gap-4",
                ingestStatus.status === 'processing' ? "bg-zinc-900/90 border-white/10" :
                  ingestStatus.status === 'completed' ? "bg-green-900/90 border-green-500/20" :
                    "bg-red-900/90 border-red-500/20"
              )}>
                {ingestStatus.status === 'processing' && (
                  <>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between text-xs text-white">
                        <span className="font-medium">Updating Knowledge Base...</span>
                        <span className="font-mono text-blue-400">{elapsedTime}</span>
                      </div>

                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-blue-500 rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${ingestStatus.progress || 0}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>

                      <div className="flex justify-between text-[10px] text-zinc-500 uppercase tracking-wider">
                        <span>{ingestStatus.message}</span>
                        <span>{ingestStatus.progress || 0}%</span>
                      </div>
                    </div>
                  </>
                )}
                {ingestStatus.status === 'completed' && (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                    <div className="flex-1 space-y-0.5">
                      <h4 className="text-sm font-medium text-white">Update Complete</h4>
                      <p className="text-xs text-green-200/60">Knowledge base is ready.</p>
                    </div>
                    <button onClick={() => setIngestStatus({ status: 'idle' })} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </>
                )}
                {ingestStatus.status === 'error' && (
                  <>
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                    <div className="flex-1 space-y-0.5">
                      <h4 className="text-sm font-medium text-white">Update Failed</h4>
                      <p className="text-xs text-red-200/60">Check console for details.</p>
                    </div>
                    <button onClick={() => setIngestStatus({ status: 'idle' })} className="text-zinc-500 hover:text-white"><X className="w-4 h-4" /></button>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}