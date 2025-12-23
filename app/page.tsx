
"use client"

import * as React from "react"
import { Send, User, Sparkles, Image as ImageIcon, Video, Pencil, GraduationCap, Clock, MessageSquare, Plus, Menu, Trash2, X } from "lucide-react"
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


  // --- Actions ---

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

  const sendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!input.trim() || isLoading) return

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    // Logic: If no current session, create one. If session exists, append.
    let sessionId = currentSessionId
    let updatedSessions = [...sessions]

    if (!sessionId) {
      sessionId = Date.now().toString()
      const newSession: ChatSession = {
        id: sessionId,
        title: generateTitle(input),
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
            {sessions.map(session => (
              <button
                key={session.id}
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
              </button>
            ))}
            {sessions.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-zinc-600">
                No history yet. Start a chat!
              </div>
            )}
          </div>
        </ScrollArea>
      </motion.div>

      {/* --- Main Content --- */}
      <div className="flex-1 flex flex-col h-full relative bg-gradient-to-br from-black via-zinc-950 to-zinc-900">

        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-white/5 bg-black/50 backdrop-blur-md sticky top-0 z-30">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-zinc-400">
            <Menu className="w-6 h-6" />
          </button>
          <span className="font-semibold text-sm">ChatBot</span>
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
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center shadow-2xl shadow-blue-500/20">
                  <Sparkles className="w-8 h-8 text-white" />
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
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-2 shadow-lg",
                      message.role === 'user' ? "bg-zinc-800 hidden md:flex" : "hidden md:flex bg-gradient-to-tr from-blue-600 to-cyan-500"
                    )}>
                      {message.role === 'user' ? (
                        <User className="w-4 h-4 text-zinc-400" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-white" />
                      )}
                    </div>

                    {/* Bubble */}
                    <div className={cn(
                      "max-w-[85%] md:max-w-[75%] space-y-2 p-4 shadow-sm",
                      message.role === 'user'
                        ? "bg-[#0A84FF] text-white rounded-[1.3rem] rounded-tr-md" /* Apple Blue */
                        : "bg-zinc-800/80 backdrop-blur-md text-zinc-100 rounded-[1.3rem] rounded-tl-md border border-white/5" /* Apple Gray */
                    )}>
                      <div className="prose prose-invert prose-p:leading-relaxed prose-pre:bg-black/30 prose-pre:p-3 prose-pre:rounded-lg max-w-none text-[0.95rem]">
                        {message.role === 'user' ? (
                          <p className="whitespace-pre-wrap">{message.content}</p>
                        ) : (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isLoading && (
                  <div className="flex gap-4 max-w-3xl mx-auto">
                    <div className="w-8 h-8 rounded-full bg-zinc-800 hidden md:flex items-center justify-center flex-shrink-0">
                      <Sparkles className="w-4 h-4 text-zinc-500 animate-pulse" />
                    </div>
                    <div className="bg-zinc-800/50 rounded-2xl p-4 flex gap-1 items-center">
                      <div className="w-2 h-2 bg-zinc-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-zinc-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-zinc-500/50 rounded-full animate-bounce" />
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
                    onClick={() => setInput(s.action)}
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
                  input.trim() ? "bg-[#0A84FF] hover:bg-[#007AFF] text-white scale-100" : "bg-zinc-700 text-zinc-500 scale-90 opacity-0 md:opacity-100" // Hide on mobile if empty like iMessage?
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

      </div>
    </div>
  )
}