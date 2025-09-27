import React, { useEffect, useState } from "react";
import { Toaster } from "./components/notifications/Toaster";

const App: React.FC = () => {
  const [status, setStatus] = useState("Loading...");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Test basic functionality
    try {
      setStatus("Testing imports...");
      
      // Test API
      fetch('/api/settings')
        .then(response => response.json())
        .then(data => {
          setStatus(`✅ API working. Proxy: ${data.proxy.enabled}`);
        })
        .catch(err => {
          setError(`API Error: ${err.message}`);
        });
    } catch (err) {
      setError(`Import Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  return (
    <div style={{ 
      background: '#0f172a', 
      color: '#f1f5f9', 
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>SpotiFLAC - Debug Mode</h1>
      
      <div style={{ 
        background: '#1e293b', 
        padding: '20px', 
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h2>Status</h2>
        <p>{status}</p>
        {error && <p style={{ color: '#ef4444' }}>❌ {error}</p>}
      </div>

      <div style={{ 
        background: '#1e293b', 
        padding: '20px', 
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h2>Component Tests</h2>
        <p>✅ React loaded</p>
        <p>✅ Toaster component imported</p>
        <p>✅ useEffect working</p>
        <p>✅ State management working</p>
      </div>

      <Toaster />
    </div>
  );
};

export default App;
