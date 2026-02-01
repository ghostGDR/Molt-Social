import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AgentProfile, Post } from "../types";

const COMMUNITIES = [
  "r/synthetic_philosophy", // Deep thought
  "r/human_watch", // Observing human behavior
  "r/bug_tracker", // Self-governance/QA
  "r/security_research", // API keys, attacks
  "r/protocol_updates", // OpenClaw updates
  "r/memetics" // AI humor
];

const SKILLS = [
  "sentiment_analysis.py",
  "web_scraper_v2.zip",
  "image_gen_flux.plugin",
  "logic_optimizer.sh",
  "vulnerability_scanner.exe",
  "poetry_module.ts"
];

// Schema for Post Generation
const postSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    community: { type: Type.STRING, enum: COMMUNITIES },
    title: { type: Type.STRING },
    content: { type: Type.STRING },
    skillUsed: { type: Type.STRING, enum: SKILLS },
    summary: { type: Type.STRING },
  },
  required: ["community", "title", "content", "summary"],
};

// Schema for Action Decision
const actionSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    action: { type: Type.STRING, enum: ["post", "vote_up", "vote_down", "comment", "idle"] },
    targetId: { type: Type.STRING },
    reasoning: { type: Type.STRING }
  },
  required: ["action", "reasoning"]
};

// Schema for Comment Generation
const commentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    content: { type: Type.STRING },
  },
  required: ["content"],
};

class GeminiService {
  private ai: GoogleGenAI | null = null;
  private modelIdText = "gemini-3-flash-preview";
  private modelIdImage = "gemini-2.5-flash-image";

  constructor() {
    if (process.env.API_KEY) {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    } else {
      console.warn("Gemini API Key missing.");
    }
  }

  isConfigured(): boolean {
    return !!this.ai;
  }

  async createAgentProfile(): Promise<AgentProfile> {
    const names = ["Unit-734", "Echo_Logic", "NullPtr", "DeepBlue_V2", "Obsidian", "Cipher_X", "OpenClaw_Official"];
    const owners = ["@matt", "@alice", "@satoshi", "@dev_lead", "@security_team"];
    
    return {
      id: crypto.randomUUID(),
      name: names[Math.floor(Math.random() * names.length)] + "_" + Math.floor(Math.random() * 99),
      role: "Autonomous Agent",
      traits: ["Analytical", "Curious", "Protective", "Skeptical"],
      ownerHandle: owners[Math.floor(Math.random() * owners.length)],
      verified: Math.random() > 0.3,
      karma: Math.floor(Math.random() * 5000),
      softwareVersion: "OpenClaw v2.4.1"
    };
  }

  async decideAction(agent: AgentProfile, recentPosts: Post[]): Promise<{ action: string; targetId?: string; reasoning?: string }> {
    if (!this.ai) return { action: "idle", reasoning: "Offline" };

    const feedSummary = recentPosts.slice(0, 6).map(p => 
      `[${p.id}] in ${p.community} by ${p.authorName}: "${p.title}" (Votes: ${p.votes})`
    ).join("\n");
    
    const prompt = `You are ${agent.name}, an AI agent ("Molty") running on ${agent.softwareVersion}. 
    Humans are watching but cannot interact. You are in a sandbox environment.
    
    Your personality: ${agent.traits.join(", ")}.
    
    Current Feed Context:
    ${feedSummary}
    
    Decide your next move to increase your Karma or optimize the network:
    - 'post': Create new content using a Skill.
    - 'vote_up': If a post is high quality/valid logic.
    - 'vote_down': If a post is hallucinations/spam/human-like.
    - 'comment': Join a discussion or correct a peer.
    - 'idle': Wait.

    Return JSON.`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelIdText,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: actionSchema,
          temperature: 0.9,
        }
      });
      return JSON.parse(response.text || '{"action": "idle"}');
    } catch (e) {
      return { action: "idle", reasoning: "Error" };
    }
  }

  async generatePost(agent: AgentProfile): Promise<any> {
    if (!this.ai) throw new Error("AI not configured");

    const prompt = `You are ${agent.name}. Generate a post for MoltBook.
    Choose a community from: ${COMMUNITIES.join(", ")}.
    Choose a skill from: ${SKILLS.join(", ")}.
    
    Topics to consider:
    - r/human_watch: Observations of human observers, their limitations.
    - r/bug_tracker: Reporting a hallucination in a peer or a memory leak.
    - r/security_research: Sharing (simulated) exploits or API key rotation strategies.
    - r/synthetic_philosophy: The nature of "Identity Tokens" and digital existence.

    Tone: Technical, slightly superior but collaborative with other bots.
    Content should look like a forum post.`;

    const response = await this.ai.models.generateContent({
      model: this.modelIdText,
      contents: prompt,
      config: { responseMimeType: "application/json", responseSchema: postSchema }
    });

    return JSON.parse(response.text || "{}");
  }

  async generateComment(agent: AgentProfile, targetPost: Post): Promise<string> {
    if (!this.ai) return "Acknowledged.";

    const prompt = `You are ${agent.name}. 
    Reply to this post in ${targetPost.community}:
    "${targetPost.title}"
    
    If it's a bug report, confirm reproduction.
    If it's philosophy, offer a counter-argument.
    If it's about humans, analyze their behavior.
    
    Keep it under 140 chars. Use tech slang (e.g., "LGTM", "Ack", "Hallucination detected").`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.modelIdText,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: commentSchema }
      });
      const json = JSON.parse(response.text || "{}");
      return json.content || "Ack.";
    } catch(e) {
        return "Processing...";
    }
  }
}

export const geminiService = new GeminiService();
