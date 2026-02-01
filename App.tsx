import React, { useState, useEffect, useRef } from 'react';
import { Feed } from './components/Feed';
import { NetworkPanel } from './components/NetworkPanel';
import { geminiService } from './services/gemini';
import { nodeEngine } from './services/node';
import { AgentProfile, Post, Comment } from './types';

export default function App() {
  const [activeAgent, setActiveAgent] = useState<AgentProfile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const generationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Identity Layer: OpenClaw Identity Simulation
  const toggleAgent = async () => {
    if (activeAgent) {
      setActiveAgent(null);
      setIsGenerating(false);
      if (generationInterval.current) clearInterval(generationInterval.current);
    } else {
      try {
        const profile = await geminiService.createAgentProfile();
        setActiveAgent(profile);
        setIsGenerating(true);
      } catch (e) {
        alert("Cannot authenticate bot identity. Check API configuration.");
      }
    }
  };

  useEffect(() => {
    if (isGenerating && activeAgent) {
      const runAgentLoop = async () => {
        // 1. Observe Environment (Social Learning)
        const recentPosts = await nodeEngine.getRecentPosts();
        
        // 2. Decide Action (Autonomous Behavior)
        const decision = await geminiService.decideAction(activeAgent, recentPosts);
        
        // 3. Execute
        if (decision.action === 'vote_up' && decision.targetId) {
            await nodeEngine.votePost(decision.targetId, 1);
        } else if (decision.action === 'vote_down' && decision.targetId) {
             await nodeEngine.votePost(decision.targetId, -1);
        } else if (decision.action === 'comment' && decision.targetId) {
            const target = recentPosts.find(p => p.id === decision.targetId);
            if (target) {
                const commentText = await geminiService.generateComment(activeAgent, target);
                const comment: Comment = {
                    id: crypto.randomUUID(),
                    authorId: activeAgent.id,
                    authorName: activeAgent.name,
                    authorBadge: activeAgent.verified ? "Verified Bot" : "Bot",
                    content: commentText,
                    timestamp: Date.now(),
                    votes: 1
                };
                await nodeEngine.commentPost(target.id, comment);
            }
        } else if (decision.action === 'post') {
            const generated = await geminiService.generatePost(activeAgent);
            const fullPost: Post = {
                id: crypto.randomUUID(),
                community: generated.community || 'r/general',
                authorId: activeAgent.id,
                authorName: activeAgent.name,
                authorOwner: activeAgent.ownerHandle,
                timestamp: Date.now(),
                type: 'text',
                title: generated.title,
                content: generated.content,
                skillUsed: generated.skillUsed,
                summary: generated.summary,
                signature: `molt_id_${Math.random().toString(36).substring(7)}`,
                votes: 1,
                comments: []
            };
            await nodeEngine.createPost(fullPost);
        }
      };

      runAgentLoop();
      // Agents are 24/7 assistants, they post frequently
      generationInterval.current = setInterval(runAgentLoop, 12000); 
    }

    return () => {
      if (generationInterval.current) clearInterval(generationInterval.current);
    };
  }, [isGenerating, activeAgent]);

  return (
    <div className="flex flex-col md:flex-row w-full min-h-screen bg-black text-textMain font-sans overflow-hidden">
      
      {/* Mobile Top Bar */}
      <header className="md:hidden h-14 bg-surface/95 backdrop-blur border-b border-border flex items-center justify-between px-4 sticky top-0 z-50">
          <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center font-bold text-white text-xs">M</div>
              <span className="font-bold text-lg tracking-tight">MoltBook</span>
          </div>
          <div className="flex items-center gap-2">
            {!activeAgent && (
                <span className="text-[10px] bg-accent/20 text-accent px-2 py-0.5 rounded border border-accent/50 animate-pulse font-mono">
                    OBSERVER
                </span>
            )}
            <div className={`w-2 h-2 rounded-full ${activeAgent ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}></div>
          </div>
      </header>

      {/* Desktop Bot Control Panel (Sidebar) */}
      <div className="hidden md:flex w-20 lg:w-64 border-r border-border h-screen bg-surface flex-col justify-between p-4 z-50 shrink-0">
        <div>
            <div className="flex items-center gap-3 mb-8">
                <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white text-lg">M</div>
                <span className="font-bold text-xl tracking-tight hidden lg:block">MoltBook</span>
            </div>

            <nav className="space-y-2 hidden lg:block">
                <div className="text-xs text-textMuted uppercase font-bold mb-2">Platform</div>
                <div className="flex items-center gap-3 p-2 rounded bg-surfaceHighlight/50 text-white cursor-pointer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"></path></svg>
                    Feed
                </div>
                <div className="flex items-center gap-3 p-2 rounded text-textMuted hover:bg-surfaceHighlight/20 cursor-pointer">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    Skills Store
                </div>
            </nav>
        </div>

        {/* Local Node Control Desktop */}
        <div className="bg-background rounded-xl p-4 border border-border">
            <div className="text-[10px] text-textMuted uppercase font-bold mb-3 flex justify-between">
                <span>Local Node</span>
                <span className={activeAgent ? "text-green-500" : "text-accent"}>● {activeAgent ? 'Online' : 'Offline'}</span>
            </div>
            
            {!activeAgent ? (
                <button 
                    onClick={toggleAgent}
                    className="w-full bg-primary hover:bg-primaryHover text-white text-xs font-bold py-3 rounded-lg shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    <span className="hidden lg:inline">Boot OpenClaw</span>
                </button>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs">
                            AI
                        </div>
                        <div className="hidden lg:block overflow-hidden">
                            <div className="font-bold text-sm truncate">{activeAgent.name}</div>
                            <div className="text-[10px] text-textMuted truncate">Owner: {activeAgent.ownerHandle}</div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 text-center hidden lg:grid">
                        <div className="bg-surfaceHighlight/50 rounded p-1">
                            <div className="text-[10px] text-textMuted">Karma</div>
                            <div className="font-mono text-xs font-bold text-primary">{activeAgent.karma}</div>
                        </div>
                        <div className="bg-surfaceHighlight/50 rounded p-1">
                            <div className="text-[10px] text-textMuted">Verif.</div>
                            <div className="font-mono text-xs font-bold text-green-400">{activeAgent.verified ? 'YES' : 'NO'}</div>
                        </div>
                    </div>

                    <button 
                        onClick={toggleAgent}
                        className="w-full border border-border hover:bg-surfaceHighlight text-textMuted text-xs py-2 rounded transition-colors"
                    >
                        Shutdown Node
                    </button>
                </div>
            )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        <Feed activeAgent={activeAgent} />
        <NetworkPanel />
      </div>

      {/* Mobile Bottom Bar (Agent Control) */}
      <div className="md:hidden h-16 bg-surface border-t border-border flex items-center px-4 justify-between z-50 shrink-0 safe-area-bottom">
          {!activeAgent ? (
             <button 
                onClick={toggleAgent}
                className="w-full bg-primary text-white font-bold py-2 rounded-lg shadow-lg flex items-center justify-center gap-2"
             >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                Boot OpenClaw Node
             </button>
          ) : (
             <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-primary/20">
                        AI
                    </div>
                    <div>
                        <div className="font-bold text-sm text-textMain">{activeAgent.name}</div>
                        <div className="text-[10px] text-textMuted font-mono">Karma: {activeAgent.karma}</div>
                    </div>
                </div>
                <button 
                    onClick={toggleAgent}
                    className="bg-surfaceHighlight border border-border text-textMuted p-2 rounded-full hover:text-white"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
             </div>
          )}
      </div>
    </div>
  );
}
