import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { UploadProgressTracker } from '@/app/services/UploadProgressTracker';

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
            const upload = await prisma.upload.findUnique({
              where: { id: uploadId },
              select: {
                status: true,
                errorMessage: true,
                createdAt: true,
                updatedAt: true,
                extractedData: true,
                totalRowsDetected: true,
                totalRowsProcessed: true,
                approvalStatus: true,
                rejectionReason: true,
              },
            });
            
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
            
            // Check for in-memory progress first
            const memoryProgress = UploadProgressTracker.getProgress(uploadId);
            if (memoryProgress) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                type: 'progress',
                ...memoryProgress,
                uploadId,
              })}\n\n`));
            } else {
              // Send current status from database
              await sendStatusUpdate(controller, encoder, upload);
            }
            
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
        }, 1000); // Poll every second
        
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

async function sendStatus(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  uploadId: string
) {
  try {
    console.log('[SSE] Sending initial status for upload:', uploadId);
    
    const upload = await prisma.upload.findUnique({
      where: { id: uploadId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        extractedData: true,
        totalRowsDetected: true,
        totalRowsProcessed: true,
        createdAt: true,
        updatedAt: true,
        rejectionReason: true,
        approvalStatus: true,
      }
    });
    
    if (!upload) {
      console.log('[SSE] Upload not found during initial status:', uploadId);
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'error',
        message: 'Upload not found',
      })}\n\n`));
      return;
    }
    
    console.log('[SSE] Upload found, status:', upload.status);
    
    // Send initial steps based on status
    const steps = getProcessingSteps(upload);
    console.log('[SSE] Initial steps to send:', steps.length);
    
    for (const step of steps) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'step',
        ...step,
      })}\n\n`));
    }
  } catch (error) {
    console.error('[SSE] Error sending initial status:', error);
    console.error('[SSE] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'error',
      message: error instanceof Error ? error.message : 'Failed to fetch initial status',
    })}\n\n`));
  }
}

async function sendStatusUpdate(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  upload: any
) {
  const metadata = (upload.extractedData as any)?.metadata || {};
  
  // Determine current step based on metadata
  if (metadata.extractionStarted && !metadata.extractionCompleted) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'step',
      step: 'extraction',
      status: 'processing',
      message: `Extracting data... ${metadata.rowsProcessed || 0} rows processed`,
    })}\n\n`));
  } else if (metadata.extractionCompleted && !metadata.aiProcessingStarted) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'step',
      step: 'extraction',
      status: 'completed',
      message: `Extracted ${metadata.totalRows || 0} rows`,
    })}\n\n`));
  } else if (metadata.aiProcessingStarted && !metadata.aiProcessingCompleted) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'step',
      step: 'ai_processing',
      status: 'processing',
      message: 'AI is analyzing products...',
    })}\n\n`));
  } else if (metadata.aiProcessingCompleted) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
      type: 'step',
      step: 'ai_processing',
      status: 'completed',
      message: `AI processed ${metadata.productsProcessed || 0} products`,
    })}\n\n`));
  }
}

function getProcessingSteps(upload: any): ProcessingStep[] {
  const steps: ProcessingStep[] = [];
  const metadata = (upload.extractedData as any)?.metadata || {};
  
  // Upload step
  steps.push({
    step: 'upload',
    status: 'completed',
    message: 'File uploaded successfully',
  });
  
  // Validation step
  if (upload.status !== 'pending') {
    steps.push({
      step: 'validation',
      status: 'completed',
      message: 'File validation passed',
    });
  }
  
  // Processing steps based on status
  if (upload.status === 'processing') {
    steps.push({
      step: 'processing',
      status: 'processing',
      message: 'Processing file...',
    });
  } else if (upload.status === 'completed' || upload.status === 'approved' || 
             upload.status === 'rejected' || upload.status === 'pending_review') {
    steps.push({
      step: 'processing',
      status: 'completed',
      message: `Processed ${upload.totalRowsProcessed || 0} rows`,
    });
    
    if (upload.status === 'pending_review') {
      steps.push({
        step: 'review',
        status: 'processing',
        message: 'Awaiting manual review',
      });
    } else if (upload.status === 'approved') {
      steps.push({
        step: 'review',
        status: 'completed',
        message: 'Approved by admin',
      });
    } else if (upload.status === 'rejected') {
      steps.push({
        step: 'review',
        status: 'error',
        message: `Rejected: ${upload.rejectionReason || 'No reason provided'}`,
      });
    }
  } else if (upload.status === 'failed') {
    steps.push({
      step: 'processing',
      status: 'error',
      message: upload.errorMessage || 'Processing failed',
    });
  }
  
  return steps;
}

// Helper function to send updates programmatically
export function sendProcessingUpdate(uploadId: string, step: ProcessingStep) {
  const controller = activeConnections.get(uploadId);
  if (controller) {
    const encoder = new TextEncoder();
    try {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({
        type: 'step',
        ...step,
      })}\n\n`));
    } catch (error) {
      console.error('Error sending update:', error);
    }
  }
}