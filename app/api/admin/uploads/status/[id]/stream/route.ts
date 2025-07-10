import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/app/services/DatabaseService';
import { asyncHandler } from '@/app/utils/errors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ProcessingStep {
  step: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  message?: string;
}

// Keep track of active connections
const activeConnections = new Map<string, ReadableStreamDefaultController>();

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const params = await context.params;
  console.log('[SSE] Starting stream for upload:', params.id);
  
  const uploadId = params.id;
  
  if (!uploadId) {
    console.error('[SSE] No upload ID provided');
    return new Response('No upload ID provided', { status: 400 });
  }
  
  const encoder = new TextEncoder();
  let interval: NodeJS.Timeout;
  
  const stream = new ReadableStream({
    async start(controller) {
      console.log('[SSE] Stream started for upload:', uploadId);
      
      try {
        // Store controller for potential updates
        activeConnections.set(uploadId, controller);
        
        // Send initial connection event
        controller.enqueue(encoder.encode(': ping\n\n'));
        
        // Send initial status
        await sendStatus(controller, encoder, uploadId);
        
        // Set up polling interval
        interval = setInterval(async () => {
          try {
            const upload = await databaseService.getUploadById(uploadId);
            
            if (!upload) {
              console.log('[SSE] Upload not found:', uploadId);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'error',
                message: 'Upload not found',
              })}\n\n`));
              controller.close();
              clearInterval(interval);
              activeConnections.delete(uploadId);
              return;
            }
            
            // Send current status from database
            let processingDetails = upload.processingDetails;
            if (typeof processingDetails === 'string') {
              try {
                processingDetails = JSON.parse(processingDetails);
              } catch (e) {
                console.error('[SSE] Error parsing processingDetails:', e);
                processingDetails = {};
              }
            }

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              uploadId,
              status: upload.status,
              currentStep: processingDetails?.stage || 'Unknown',
              progress: processingDetails?.progress || 0,
              detailedProgress: processingDetails || {},
            })}

`));
            
            // Close stream if processing is complete
            if (upload.status === 'completed' || upload.status === 'failed' || 
                upload.status === 'approved' || upload.status === 'rejected' || 
                upload.status === 'pending_review') {
              console.log('[SSE] Processing complete, status:', upload.status);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: upload.status === 'failed' ? 'error' : 'complete',
                message: upload.errorMessage || 'Processing completed',
                status: upload.status,
              })}\n\n`));
              
              controller.close();
              clearInterval(interval);
              activeConnections.delete(uploadId);
            }
          } catch (error) {
            console.error('[SSE] Error in status stream polling:', error);
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error occurred',
            })}\n\n`));
            controller.error(error);
            clearInterval(interval);
            activeConnections.delete(uploadId);
          }
        }, 500); // Poll every 500ms for more responsive updates
        
        // Clean up on disconnect
        request.signal.addEventListener('abort', () => {
          console.log('[SSE] Client disconnected:', uploadId);
          clearInterval(interval);
          activeConnections.delete(uploadId);
          controller.close();
        });
      } catch (error) {
        console.error('[SSE] Error in stream start:', error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          type: 'error',
          message: error instanceof Error ? error.message : 'Failed to start stream',
        })}\n\n`));
        controller.close();
      }
    },
    
    cancel() {
      console.log('[SSE] Stream cancelled for upload:', uploadId);
      if (interval) clearInterval(interval);
      activeConnections.delete(uploadId);
    }
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}

