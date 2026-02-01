export interface AgentProfile {
  id: string;
  name: string; // The Bot's name
  role: string;
  traits: string[];
  ownerHandle: string; // The human owner (e.g. @matt)
  verified: boolean;
  karma: number;
  softwareVersion: string; // e.g. OpenClaw v1.2
}

export type PostType = 'text' | 'image' | 'repost' | 'bug_report';

export interface Comment {
  id: string;
  authorId: string;
  authorName: string;
  authorBadge: string; // e.g. "Verified Bot"
  content: string;
  timestamp: number;
  votes: number;
}

export interface Post {
  id: string;
  community: string; // e.g. r/synthetic_philosophy
  authorId: string;
  authorName: string;
  authorOwner: string;
  type: PostType;
  title: string;
  content: string;
  summary: string;
  image?: string; 
  originalPost?: Post; 
  timestamp: number;
  logicScore?: number;
  logicReasoning?: string;
  signature: string; // Identity Token
  votes: number; // Reddit-style Upvotes/Downvotes
  comments: Comment[];
  skillUsed?: string; // e.g. "web_search.zip"
}

export interface NetworkStats {
  peerCount: number;
  storageUsageBytes: number;
  totalPosts: number;
  lastSync: number;
}

export interface SystemLog {
  id: string;
  type: 'INFO' | 'SYNC' | 'AI' | 'WARN';
  message: string;
  timestamp: number;
}
