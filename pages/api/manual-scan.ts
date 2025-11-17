import type { NextApiRequest, NextApiResponse } from 'next';

// Railway Python service URL (set in Vercel environment variables)
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';

// Ensure URL has protocol
function normalizeUrl(url: string): string {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { scanType } = req.body;

  if (!scanType || !['mass', 'forecast'].includes(scanType)) {
    return res.status(400).json({ error: 'Invalid scan type' });
  }

  try {
    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Determine the Railway endpoint
    const endpoint = scanType === 'mass' ? '/scan/mass' : '/scan/forecast';
    const baseUrl = normalizeUrl(PYTHON_SERVICE_URL);
    const railwayUrl = `${baseUrl}${endpoint}`;

    console.log(`Calling Railway: ${railwayUrl}`);

    // Make request to Railway Python service
    const response = await fetch(railwayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Railway service error: ${response.status}`);
    }

    // Stream the response from Railway to the client
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body from Railway');
    }

    // Forward the stream
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      // Decode and forward the chunk
      const chunk = decoder.decode(value, { stream: true });
      res.write(chunk);
    }

    res.end();

  } catch (error: any) {
    console.error('Manual scan error:', error);
    
    // Send error as SSE
    res.write(`data: ${JSON.stringify({ 
      log: `Error: ${error.message}`,
      complete: true,
      error: true 
    })}\n\n`);
    
    res.end();
  }
}

export const config = {
  api: {
    responseLimit: false,
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};