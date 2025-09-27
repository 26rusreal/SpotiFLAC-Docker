import React from "react";

const App: React.FC = () => {
  return (
    <div style={{ 
      background: '#0f172a', 
      color: '#f1f5f9', 
      minHeight: '100vh',
      padding: '20px',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1>SpotiFLAC - Minimal Test</h1>
      <p>If you can see this, React is working!</p>
      <div style={{ 
        background: '#1e293b', 
        padding: '20px', 
        borderRadius: '8px',
        margin: '20px 0'
      }}>
        <h2>Status</h2>
        <p>✅ React loaded</p>
        <p>✅ Component rendered</p>
        <p>✅ Styling applied</p>
      </div>
    </div>
  );
};

export default App;
