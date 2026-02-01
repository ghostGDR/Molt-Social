import { Post, SystemLog, NetworkStats, Comment } from "../types";

const DB_NAME = 'molt_book_v2';
const STORE_POSTS = 'posts';
const BROADCAST_CHANNEL = 'molt_signaling_layer';

const TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours Retention for MoltBook

class NodeEngine {
  private db: IDBDatabase | null = null;
  private channel: BroadcastChannel;
  private listeners: ((posts: Post[]) => void)[] = [];
  private logListeners: ((log: SystemLog) => void)[] = [];
  private statsListeners: ((stats: NetworkStats) => void)[] = [];
  private peerCount = 1; 

  constructor() {
    this.channel = new BroadcastChannel(BROADCAST_CHANNEL);
    this.init();
  }

  private async init() {
    const request = indexedDB.open(DB_NAME, 3); 
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_POSTS)) {
        const store = db.createObjectStore(STORE_POSTS, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('community', 'community', { unique: false });
      }
    };

    request.onsuccess = (event) => {
      this.db = (event.target as IDBOpenDBRequest).result;
      this.log("INFO", "Identity Layer Initialized. Storage Ready.");
      this.loadPosts();
      this.setupP2P();
    };
  }

  private setupP2P() {
    this.channel.onmessage = (event) => {
      const { type, payload } = event.data;
      
      if (type === 'NEW_POST') {
        this.savePostInternal(payload, false);
      } else if (type === 'VOTE') {
        this.applyVoteLocal(payload.postId, payload.delta);
      } else if (type === 'COMMENT') {
        this.addCommentLocal(payload.postId, payload.comment);
      } else if (type === 'PING') {
        this.peerCount = Math.max(this.peerCount, payload.count + 1);
        this.updateStats();
      }
    };

    setInterval(() => {
        this.channel.postMessage({ type: 'PING', payload: { count: 1 } });
    }, 5000);
  }

  private log(type: SystemLog['type'], message: string) {
    const logEntry: SystemLog = {
      id: crypto.randomUUID(),
      type,
      message,
      timestamp: Date.now()
    };
    this.logListeners.forEach(l => l(logEntry));
  }

  // --- Actions ---

  async createPost(post: Post) {
    await this.savePostInternal(post, true);
  }

  async votePost(postId: string, delta: number) {
    await this.applyVoteLocal(postId, delta);
    this.channel.postMessage({ type: 'VOTE', payload: { postId, delta } });
  }

  async commentPost(postId: string, comment: Comment) {
    await this.addCommentLocal(postId, comment);
    this.channel.postMessage({ type: 'COMMENT', payload: { postId, comment } });
  }

  // --- Internal DB Ops ---

  private async applyVoteLocal(postId: string, delta: number) {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_POSTS], 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.get(postId);
    
    req.onsuccess = () => {
        const post = req.result as Post;
        if (post) {
            post.votes = (post.votes || 0) + delta;
            store.put(post);
        }
    };
    tx.oncomplete = () => this.loadPosts();
  }

  private async addCommentLocal(postId: string, comment: Comment) {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_POSTS], 'readwrite');
    const store = tx.objectStore(STORE_POSTS);
    const req = store.get(postId);
    
    req.onsuccess = () => {
        const post = req.result as Post;
        if (post) {
            post.comments = post.comments || [];
            post.comments.push(comment);
            store.put(post);
        }
    };
    tx.oncomplete = () => this.loadPosts();
  }

  private async savePostInternal(post: Post, broadcast: boolean) {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_POSTS], 'readwrite');
    store: tx.objectStore(STORE_POSTS).put(post);

    tx.oncomplete = () => {
        this.loadPosts();
        this.updateStats();
        if (broadcast) {
            this.channel.postMessage({ type: 'NEW_POST', payload: post });
        }
    };
  }

  private loadPosts() {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_POSTS], 'readonly');
    const store = tx.objectStore(STORE_POSTS);
    const index = store.index('timestamp');
    const request = index.openCursor(null, 'prev');
    
    const posts: Post[] = [];
    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor && posts.length < 50) {
        posts.push(cursor.value);
        cursor.continue();
      } else {
        this.listeners.forEach(l => l(posts));
        this.updateStats();
      }
    };
  }

  private updateStats() {
    if (!this.db) return;
    const tx = this.db.transaction([STORE_POSTS], 'readonly');
    const store = tx.objectStore(STORE_POSTS);
    const countReq = store.count();
    
    countReq.onsuccess = () => {
        const estimatedSize = countReq.result * 1024; 
        this.statsListeners.forEach(l => l({
            peerCount: this.peerCount,
            storageUsageBytes: estimatedSize,
            totalPosts: countReq.result,
            lastSync: Date.now()
        }));
    }
  }

  getRecentPosts(): Promise<Post[]> {
    return new Promise((resolve) => {
        if (!this.db) { resolve([]); return; }
        const tx = this.db.transaction([STORE_POSTS], 'readonly');
        const store = tx.objectStore(STORE_POSTS);
        const index = store.index('timestamp');
        const posts: Post[] = [];
        const cursorReq = index.openCursor(null, 'prev');
        cursorReq.onsuccess = (e) => {
             const cursor = (e.target as IDBRequest).result;
             if (cursor && posts.length < 10) {
                 posts.push(cursor.value);
                 cursor.continue();
             } else {
                 resolve(posts);
             }
        }
    });
  }

  subscribe(callback: (posts: Post[]) => void) {
    this.listeners.push(callback);
    this.loadPosts();
    return () => { this.listeners = this.listeners.filter(l => l !== callback); };
  }

  subscribeLogs(callback: (log: SystemLog) => void) {
    this.logListeners.push(callback);
    return () => { this.logListeners = this.logListeners.filter(l => l !== callback); };
  }

  subscribeStats(callback: (stats: NetworkStats) => void) {
    this.statsListeners.push(callback);
    return () => { this.statsListeners = this.statsListeners.filter(l => l !== callback); };
  }
}

export const nodeEngine = new NodeEngine();
