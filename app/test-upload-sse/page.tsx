'use client';

import { useState } from 'react';

export default function TestUploadSSEPage() {
  const [uploadId, setUploadId] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [error, setError] = useState<string | null>(null);
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const connectToSSE = () => {
    if (!uploadId) {
      setError('Please enter an upload ID');
      return;
    }

    // Close existing connection
    if (eventSource) {
      eventSource.close();
    }

    setMessages([]);
    setError(null);
    setConnectionStatus('connecting');

    const url = `/api/uploads/status/${uploadId}/stream`;
    console.log('Connecting to:', url);
    
    const es = new EventSource(url);
    setEventSource(es);
    
    es.onopen = () => {
      console.log('SSE connection opened');
      setConnectionStatus('connected');
    };

    es.onmessage = (event) => {
      console.log('SSE message received:', event.data);
      try {
        const data = JSON.parse(event.data);
        setMessages(prev => [...prev, { ...data, timestamp: new Date().toISOString() }]);
        
        if (data.type === 'complete' || data.type === 'error') {
          es.close();
          setConnectionStatus('completed');
          setEventSource(null);
        }
      } catch (err) {
        console.error('Error parsing SSE data:', err);
        setMessages(prev => [...prev, { 
          type: 'parse-error', 
          raw: event.data,
          error: err.message,
          timestamp: new Date().toISOString()
        }]);
      }
    };

    es.onerror = (err) => {
      console.error('SSE error:', err);
      console.log('ReadyState:', es.readyState);
      setConnectionStatus('error');
      setError('Connection error occurred');
      es.close();
      setEventSource(null);
    };
  };

  const disconnect = () => {
    if (eventSource) {
      eventSource.close();
      setEventSource(null);
    }
    setConnectionStatus('disconnected');
  };

  const testDebugEndpoint = async () => {
    if (!uploadId) {
      setError('Please enter an upload ID');
      return;
    }

    try {
      const response = await fetch(`/api/uploads/status/${uploadId}/debug`);
      const data = await response.json();
      console.log('Debug endpoint response:', data);
      setMessages(prev => [...prev, { 
        type: 'debug-response', 
        data,
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error('Debug endpoint error:', err);
      setError(err.message);
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Upload SSE Test Page</h1>
      
      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Upload ID:</label>
          <input
            type="text"
            value={uploadId}
            onChange={(e) => setUploadId(e.target.value)}
            placeholder="Enter upload ID"
            className="w-full p-2 border rounded"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={connectToSSE}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={connectionStatus === 'connecting' || connectionStatus === 'connected'}
          >
            {connectionStatus === 'connecting' ? 'Connecting...' : 
             connectionStatus === 'connected' ? 'Connected' : 'Connect to SSE'}
          </button>
          
          <button
            onClick={disconnect}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            disabled={connectionStatus !== 'connected'}
          >
            Disconnect
          </button>

          <button
            onClick={testDebugEndpoint}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Test Debug Endpoint
          </button>
        </div>
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
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {messages.map((msg, index) => (
              <div key={index} className="p-2 bg-white rounded shadow text-sm">
                <div className="text-xs text-gray-500 mb-1">{msg.timestamp}</div>
                <pre className="whitespace-pre-wrap">{JSON.stringify(msg, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}