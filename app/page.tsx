
"use client"

import * as React from "react"
import { Send, User, Image as ImageIcon, Video, Pencil, MessageSquare, Plus, Menu, Trash2, X, Copy, ThumbsUp, ThumbsDown, RotateCw, MoreHorizontal, ChevronDown, Database, Globe, Layers, Cpu, Workflow, Bot, Loader2 } from "lucide-react"
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
import LiquidGradient from "@/components/LiquidGradient"
import { OrganicBorder } from "@/components/OrganicBorder"
import { useTranslation } from "@/hooks/useTranslation"
import { PanelLeftClose, PanelLeftOpen } from "lucide-react"
import CustomCursor from "@/components/CustomCursor"

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

const sourceUrls = [
  "https://www.formula1.com/en/latest.html",
  "https://www.autosport.com/f1/news",
  "https://www.motorsport.com/f1/news"
]

export default function Home() {
  // State
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null)
  const [input, setInput] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false) // Mobile/Desktop toggle
  const [userLanguage, setUserLanguage] = React.useState<string>('en-US')
  const [feedback, setFeedback] = React.useState<Record<string, 'up' | 'down' | null>>({})
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false)
  const [showSplash, setShowSplash] = React.useState(true) // Restoring Splash Screen
  const [isInputPaused, setIsInputPaused] = React.useState(false)
  const { t } = useTranslation()
  const [showBackgroundEffect, setShowBackgroundEffect] = React.useState(false)

  // Context / Knowledge Base State
  const [isContextModalOpen, setIsContextModalOpen] = React.useState(false)

  // Feedback Handlers
  const handleFeedback = (messageId: string, type: 'up' | 'down') => {
    setFeedback(prev => ({
      ...prev,
      [messageId]: prev[messageId] === type ? null : type // Toggle
    }))
  }

  const regenerateResponse = async (messageId: string) => {
    if (isLoading || !currentSessionId) return

    // Find the session and messages
    const session = sessions.find(s => s.id === currentSessionId)
    if (!session) return

    // Filter out the message to be regenerated (and any potential subsequent ones, though there shouldn't be any if it's the last)
    // We assume we are regenerating the *last* assistant message.
    const messageIndex = session.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // New history is everything BEFORE this message
    const historyToUse = session.messages.slice(0, messageIndex)

    // Verify the last message in history is a USER message
    if (historyToUse.length === 0 || historyToUse[historyToUse.length - 1].role !== 'user') {
      // Cannot regenerate without a user prompt
      return
    }

    // Optimistically update UI to remove the old message
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: historyToUse }
      }
      return s
    }))

    setIsLoading(true)

    // Reuse stream logic (Standardize this if possible, but for now implementing directly)
    const assistantMsgId = (Date.now()).toString()
    const assistantMessagePlaceholder: Message = {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date()
    }

    // Add placeholder
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return { ...s, messages: [...historyToUse, assistantMessagePlaceholder] }
      }
      return s
    }))

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: currentSessionId,
          userLanguage,
          messages: historyToUse.map(m => ({
            role: m.role,
            content: m.content
          }))
        }),
      })

      if (!response.ok) throw new Error(response.statusText)

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

        setSessions(prev => prev.map(s => {
          if (s.id === currentSessionId) {
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
      console.error("Regeneration error:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const [sourceUrls] = React.useState([
    'https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship',
    'https://en.wikipedia.org/wiki/2025_Formula_One_World_Championship',
    'https://www.formula1.com/en/teams.html',
    'https://www.formula1.com/en/drivers.html',
    'https://www.formula1.com/en/results/2025/races',
    'https://www.formula1.com/en/results/2024/races',
    'https://www.skysports.com/f1',
    'https://www.skysports.com/f1/news/12433/13071399/f1-2024-cars-launched-ferrari-mercedes-red-bull-and-more-revealed-for-new-formula-1-season'
  ])

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

  // Detect Language
  React.useEffect(() => {
    if (typeof navigator !== 'undefined') {
      setUserLanguage(navigator.language)
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const startNewChat = () => {
    setCurrentSessionId(null)
    setInput('')
    setIsSidebarOpen(false) // Close sidebar on mobile
  }

  const toggleSidebar = () => setIsSidebarCollapsed(!isSidebarCollapsed)

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
          sessionId,
          userLanguage, // Send detected language
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
    { icon: <ImageIcon className="w-4 h-4 text-yellow-400" />, label: "About the 2025 cars", action: "What do the 2025 F1 cars look like?" },
    { icon: <Video className="w-4 h-4 text-blue-400" />, label: "Best overtakes of 2025", action: "Tell me about the best overtakes of 2025" },
    { icon: <Pencil className="w-4 h-4 text-purple-400" />, label: "Write a poem about Senna", action: "Write a short poem about Ayrton Senna" },
  ]

  return (
    <div className="flex h-screen w-full bg-black text-white font-sans overflow-hidden selection:bg-zinc-700/30 cursor-none">
      <CustomCursor />

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      {/* Sidebar - Only show if there is history */}
      {sessions.length > 0 && (
        <motion.div
          animate={{ width: isSidebarCollapsed ? 60 : 300 }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          className={cn(
            "fixed inset-y-0 left-0 z-50 bg-zinc-950/60 backdrop-blur-2xl border-r border-white/5 md:relative md:translate-x-0 overflow-hidden shadow-2xl",
            isSidebarOpen ? "translate-x-0 w-[300px]" : "-translate-x-full w-[300px]",
            "md:translate-x-0" // Reset translate for desktop
          )}
        >
          <div className="flex flex-col h-full p-4">
            <div className={cn("flex items-center mb-8", isSidebarCollapsed ? "justify-center" : "justify-between px-2")}>
              <Button variant="ghost" size="icon" className="hidden md:flex text-zinc-400 hover:text-white" onClick={toggleSidebar}>
                {isSidebarCollapsed ? <PanelLeftOpen className="w-5 h-5" /> : <PanelLeftClose className="w-5 h-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="md:hidden text-zinc-400" onClick={() => setIsSidebarOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <Button
              onClick={startNewChat}
              className={cn(
                "w-full mb-8 group transition-all duration-300 relative overflow-hidden backdrop-blur-md",
                isSidebarCollapsed
                  ? "bg-transparent hover:bg-white/5 text-white justify-center px-0"
                  : "bg-white/5 hover:bg-white/10 text-white border border-white/10 shadow-lg justify-start gap-3"
              )}
              title={t('new_chat')}
            >
              <div className={cn("absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000", isSidebarCollapsed && "hidden")} />
              <Plus className={cn("w-5 h-5 transition-transform group-hover:rotate-90 text-zinc-300 group-hover:text-white")} />
              {!isSidebarCollapsed && <span className="font-medium tracking-wide text-zinc-200 group-hover:text-white">{t('new_chat')}</span>}
            </Button>

            <div className="flex-1 overflow-hidden">
              {!isSidebarCollapsed && (
                <div className="text-xs font-medium text-zinc-500 mb-3 px-2 uppercase tracking-wider">{t('history')}</div>
              )}
              {!isSidebarCollapsed && (
                <ScrollArea className="h-[calc(100vh-250px)]">
                  <div className="space-y-1">
                    {sessions.map(session => (
                      <div
                        key={session.id}
                        onClick={() => loadSession(session.id)}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl text-sm transition-all group flex items-center justify-between relative overflow-hidden cursor-pointer",
                          currentSessionId === session.id
                            ? "bg-white/10 text-white font-medium shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/5"
                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200 hover:border-white/5 border border-transparent"
                        )}
                      >
                        {currentSessionId === session.id && (
                          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent opacity-50 pointer-events-none" />
                        )}
                        <span className="truncate max-w-[180px]">{session.title}</span>
                        <button
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                          onClick={(e) => deleteSession(e, session.id)}
                        >
                          <Trash2 className="w-3 h-3 text-zinc-400 hover:text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
              {isSidebarCollapsed && (
                <div className="flex flex-col items-center gap-2 mt-4">
                  <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-white" title="History hidden">
                    <MessageSquare className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-white/5 space-y-2">
              <Button
                variant="ghost"
                className={cn("w-full justify-start gap-2 text-zinc-400 hover:text-white text-xs", isSidebarCollapsed && "justify-center px-0")}
                onClick={() => setIsContextModalOpen(true)}
              >
                <Database className="w-4 h-4" />
                {!isSidebarCollapsed && <span>{t('knowledge_base')}</span>}
              </Button>
              <Button
                variant="ghost"
                className={cn("w-full justify-start gap-2 text-zinc-400 hover:text-white text-xs", isSidebarCollapsed && "justify-center px-0")}
                onClick={() => setShowBackgroundEffect(!showBackgroundEffect)}
              >
                <Layers className="w-4 h-4 text-purple-400" />
                {!isSidebarCollapsed && <span>{showBackgroundEffect ? "Disable Effects" : "Enable Effects"}</span>}
              </Button>
              <a href="https://devleor.io" target="_blank" rel="noopener noreferrer" className="block w-full">
                <Button variant="ghost" className={cn("w-full justify-start gap-2 text-zinc-400 hover:text-white text-xs", isSidebarCollapsed && "justify-center px-0")}>
                  <User className="w-4 h-4" />
                  {!isSidebarCollapsed && t('hire_me')}
                </Button>
              </a>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative w-full">
        {/* Dynamic Background */}
        {showBackgroundEffect && (
          <div className="absolute inset-0 z-0 pointer-events-none opacity-40">
            <LiquidGradient />
          </div>
        )}

        {/* Header */}
        {/* Mobile Menu Trigger */}
        {sessions.length > 0 && (
          <div className="absolute top-4 left-4 z-20 md:hidden">
            <Button variant="ghost" size="icon" className="text-zinc-400 bg-black/50 backdrop-blur-sm border border-white/10" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </Button>
          </div>
        )}

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
                  {t('splash_title')}
                </h1>
                <div className="text-zinc-400/80 text-lg">
                  {t('splash_subtitle')}
                </div>
              </div>
            </motion.div>
          ) : (
            /* Messages List */
            <ScrollArea ref={scrollRef} className="flex-1 p-4 md:p-8">
              <div className="space-y-6 pb-32 max-w-3xl mx-auto">
                {displayMessages.map((message) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
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
                        <div className="font-semibold text-sm text-white/90 mb-1 ml-1">Senna AI</div>
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
                          <Button
                            onClick={() => handleFeedback(message.id, 'up')}
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors",
                              feedback[message.id] === 'up' && "text-green-400 hover:text-green-300"
                            )}
                          >
                            <ThumbsUp className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleFeedback(message.id, 'down')}
                            variant="ghost"
                            size="icon"
                            className={cn(
                              "h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors",
                              feedback[message.id] === 'down' && "text-red-400 hover:text-red-300"
                            )}
                          >
                            <ThumbsDown className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => regenerateResponse(message.id)}
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-md text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                            title="Regenerate"
                          >
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
            {/* Input Bar */}
            {showBackgroundEffect ? (
              <OrganicBorder isPaused={isInputPaused}>
                <div className="bg-zinc-800/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-1.5 focus-within:bg-zinc-800/60 focus-within:border-white/20 transition-all shadow-2xl flex items-center gap-2">
                  <div className="p-2">
                    <Plus className="w-6 h-6 text-zinc-400 cursor-pointer hover:text-white transition-colors" /> {/* Apple-style attachment icon */}
                  </div>
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onFocus={() => setIsInputPaused(true)}
                    onBlur={() => setIsInputPaused(false)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        if (!input.trim()) return
                        sendMessage()
                        setIsInputPaused(false)
                      }
                    }}
                    placeholder={t('enter_message')}
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
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                  </Button>
                </div>
              </OrganicBorder>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] p-1.5 focus-within:border-zinc-700 transition-all flex items-center gap-2">
                <div className="p-2">
                  <Plus className="w-6 h-6 text-zinc-400 cursor-pointer hover:text-white transition-colors" />
                </div>
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!input.trim()) return
                      sendMessage()
                    }
                  }}
                  placeholder={t('enter_message')}
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
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
                </Button>
              </div>
            )}
            <div className="text-center mt-3 text-xs text-zinc-500 font-medium flex items-center justify-center gap-2">
              <span>Senna AI can make mistakes. Check important information.</span>
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
                className="bg-[#1c1c1e] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
              >
                <div className="p-6">

                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold flex items-center gap-2 text-white">
                      <Database className="w-6 h-6 text-blue-500" />
                      {t('knowledge_base')}
                    </h2>
                    <button onClick={() => setIsContextModalOpen(false)} className="text-zinc-500 hover:text-white">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1: Sources */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                        <Globe className="w-4 h-4 text-blue-400" />
                        Data Sources
                      </div>
                      <ScrollArea className="h-48 pr-4">
                        <div className="space-y-2">
                          {sourceUrls.map((url, i) => (
                            <div key={i} className="group flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5 hover:border-blue-500/30 transition-all">
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500/50 group-hover:bg-blue-400 flex-shrink-0" />
                              <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 truncate hover:text-white hover:underline transition-colors flex-1">
                                {url}
                              </a>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>

                    {/* Column 2: Tech Stack */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                        <Layers className="w-4 h-4 text-purple-400" />
                        Tech Stack
                      </div>
                      <div className="space-y-2">
                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                          <div className="p-2 bg-purple-500/20 rounded-lg">
                            <Database className="w-4 h-4 text-purple-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">Astra DB</div>
                            <div className="text-xs text-zinc-500">Vector Database (DataStax)</div>
                          </div>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                          <div className="p-2 bg-green-500/20 rounded-lg">
                            <Workflow className="w-4 h-4 text-green-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">LangChain</div>
                            <div className="text-xs text-zinc-500">{t('orchestration')}</div>
                          </div>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                          <div className="p-2 bg-yellow-500/20 rounded-lg">
                            <Cpu className="w-4 h-4 text-yellow-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">Hugging Face</div>
                            <div className="text-xs text-zinc-500">{t('inference')}</div>
                          </div>
                        </div>

                        <div className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center gap-3">
                          <div className="p-2 bg-cyan-500/20 rounded-lg">
                            <Bot className="w-4 h-4 text-cyan-400" />
                          </div>
                          <div>
                            <div className="text-sm font-medium text-white">Puppeteer</div>
                            <div className="text-xs text-zinc-500">{t('scraping')}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-white/5 flex justify-end">
                    <Button onClick={() => setIsContextModalOpen(false)} className="bg-white text-black hover:bg-zinc-200">
                      {t('close')}
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {showSplash && <SplashLogo onComplete={() => setShowSplash(false)} />}
      </div>
    </div>
  )
}