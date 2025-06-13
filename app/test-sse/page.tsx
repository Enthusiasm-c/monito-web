'use client';

import { useEffect, useState } from 'react';

export default function TestSSEPage() {
  const [messages, setMessages] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [error, setError] = useState<string | null>(null);

  const connectToSSE = () => {
    setMessages([]);
    setError(null);
    setConnectionStatus('connecting');

    const eventSource = new EventSource('/api/test-sse');
    
    eventSource.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus('connected');
    };

    eventSource.onmessage = (event) => {
      console.log('SSE message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, data]);
        
        if (data.type === 'complete') {
          eventSource.close();
          setConnectionStatus('completed');
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('SSE error:', err);
      setConnectionStatus('error');
      setError('Connection error occurred');
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">SSE Test Page</h1>
      
      <div className="mb-6">
        <button
          onClick={connectToSSE}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          disabled={connectionStatus === 'connecting' || connectionStatus === 'connected'}
        >
          {connectionStatus === 'connecting' ? 'Connecting...' : 'Start SSE Test'}
        </button>
      </div>

      <div className="mb-4">
        <strong>Connection Status:</strong> 
        <span className={`ml-2 ${
          connectionStatus === 'connected' ? 'text-green-600' :
          connectionStatus === 'error' ? 'text-red-600' :
          connectionStatus === 'completed' ? 'text-blue-600' :
          'text-gray-600'
        }`}>
          {connectionStatus}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Messages:</h2>
        {messages.length === 0 ? (
          <p className="text-gray-500">No messages yet</p>
        ) : (
          <ul className="space-y-2">
            {messages.map((msg, index) => (
              <li key={index} className="p-2 bg-white rounded shadow">
                <pre className="text-sm">{JSON.stringify(msg, null, 2)}</pre>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}