const { spawn } = require('child_process');

console.log('🔍 Testing server stability...');

const server = spawn('npm', ['run', 'dev'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let serverReady = false;
let crashed = false;
const startTime = Date.now();

server.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`[STDOUT] ${output.trim()}`);
  
  if (output.includes('Ready in')) {
    serverReady = true;
    console.log('✅ Server is ready');
  }
});

server.stderr.on('data', (data) => {
  const error = data.toString();
  console.log(`[STDERR] ${error.trim()}`);
});

server.on('close', (code, signal) => {
  crashed = true;
  const runtime = Date.now() - startTime;
  console.log(`💥 Server crashed after ${runtime}ms with code: ${code}, signal: ${signal}`);
  
  if (runtime < 2 * 60 * 1000) {
    console.log('⚠️ Server crashed in less than 2 minutes - this indicates a stability issue');
  }
  
  process.exit(1);
});

server.on('error', (error) => {
  console.log(`❌ Server error: ${error.message}`);
});

// Monitor for 3 minutes
setTimeout(() => {
  if (!crashed && serverReady) {
    console.log('✅ Server has been stable for 3 minutes');
    server.kill();
    process.exit(0);
  } else if (!serverReady) {
    console.log('⚠️ Server not ready after 3 minutes');
    server.kill();
    process.exit(1);
  }
}, 3 * 60 * 1000);

console.log('⏱️ Monitoring server for 3 minutes...');