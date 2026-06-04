import { useEffect, useState } from 'react';

function DiagnosticApp() {
  const [status, setStatus] = useState('Initializing...');

  useEffect(() => {
    setStatus('App mounted successfully!');
    console.log('Diagnostic App loaded');
    
    // Check if localStorage works
    localStorage.setItem('test', 'ok');
    console.log('localStorage works');
  }, []);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', backgroundColor: 'var(--background)', minHeight: '100vh' }}>
      <h1>Diagnostic Mode</h1>
      <p>Status: {status}</p>
      <p>This means React is rendering!</p>
      <button onClick={() => window.location.href = 'http://localhost:5173/'}>
        Go back to main app
      </button>
    </div>
  );
}

export default DiagnosticApp;
