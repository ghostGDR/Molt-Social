import React, { useEffect, useState, useRef } from 'react';
import { nodeEngine } from '../services/node';
import { SystemLog, NetworkStats } from '../types';

export const NetworkPanel: React.FC = () => {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [stats, setStats] = useState<NetworkStats>({ peerCount: 0, storageUsageBytes: 0, totalPosts: 0, lastSync: 0 });
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubLogs = nodeEngine.subscribeLogs((log) => {
      setLogs(prev => [...prev.slice(-49), log]);
    });
    const unsubStats = nodeEngine.subscribeStats((s) => setStats(s));
    return () => { unsubLogs(); unsubStats(); };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-80 border-l border-border bg-background flex flex-col h-screen fixed right-0 top-0 hidden md:flex">
      {/* Topology Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-xs font-mono font-bold text-textMuted uppercase tracking-wider mb-4">Network Topology</h2>
        
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface p-3 rounded-md border border-border">
            <div className="text-textMuted text-[10px] uppercase">Active Nodes</div>
            <div className="text-xl font-mono text-primary font-bold flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                </span>
                {stats.peerCount}
            </div>
          </div>
          <div className="bg-surface p-3 rounded-md border border-border">
            <div className="text-textMuted text-[10px] uppercase">Local Storage</div>
            <div className="text-xl font-mono text-textMain font-bold">{formatBytes(stats.storageUsageBytes)}</div>
          </div>
          <div className="bg-surface p-3 rounded-md border border-border col-span-2">
            <div className="flex justify-between items-center mb-1">
                <div className="text-textMuted text-[10px] uppercase">Cache Status</div>
                <div className="text-[10px] text-accent">10m TTL Active</div>
            </div>
            <div className="w-full bg-surfaceHighlight rounded-full h-1.5">
              <div className="bg-accent h-1.5 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <div className="mt-2 text-xs text-textMuted">
              {stats.totalPosts} cached objects
            </div>
          </div>
        </div>
      </div>

      {/* Terminal / Logs */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="p-2 bg-surfaceHighlight text-[10px] font-mono text-textMuted flex justify-between">
            <span>SYSTEM LOGS</span>
            <span>OPFS: MOUNTED</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-xs">
          {logs.length === 0 && <div className="text-textMuted italic">Waiting for signal...</div>}
          {logs.map((log) => (
            <div key={log.id} className="break-words">
              <span className="text-textMuted">[{new Date(log.timestamp).toLocaleTimeString().split(' ')[0]}]</span>{' '}
              <span className={`${
                log.type === 'WARN' ? 'text-accent' : 
                log.type === 'SYNC' ? 'text-primary' : 
                'text-textMain'
              }`}>
                {log.type}
              </span>
              <span className="text-textMuted"> :: </span>
              <span className="text-gray-400">{log.message}</span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
};
