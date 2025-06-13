import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      console.log('[TEST-SSE] Stream started');
      
      try {
        // Send initial ping
        controller.enqueue(encoder.encode(': ping\n\n'));
        
        // Send test events
        for (let i = 0; i < 5; i++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          const message = `data: ${JSON.stringify({
            type: 'test',
            count: i + 1,
            message: `Test event ${i + 1}`,
            timestamp: new Date().toISOString()
          })}\n\n`;
          
          console.log('[TEST-SSE] Sending:', message.trim());
          controller.enqueue(encoder.encode(message));
        }
        
        // Send completion
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'complete',
          message: 'Test completed'
        })}\n\n`));
        
        controller.close();
      } catch (error) {
        console.error('[TEST-SSE] Error:', error);
        controller.error(error);
      }
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}