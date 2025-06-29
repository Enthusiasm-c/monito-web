#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URLSearchParams } = require('url');

// Allow self-signed certificates
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

class AuthenticationDebugger {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
    this.requests = [];
    this.responses = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      'info': 'ℹ️ ',
      'success': '✅ ',
      'error': '❌ ',
      'warning': '⚠️ ',
      'debug': '🔍 '
    }[type] || 'ℹ️ ';
    
    console.log(`${prefix}[${timestamp}] ${message}`);
  }

  parseCookies(headers) {
    const setCookieHeaders = headers['set-cookie'] || [];
    for (const cookieHeader of setCookieHeaders) {
      const [cookiePart] = cookieHeader.split(';');
      const [name, value] = cookiePart.split('=');
      if (name && value) {
        this.cookies.set(name.trim(), value.trim());
        this.log(`Cookie stored: ${name.trim()}=${value.trim().substring(0, 20)}...`, 'debug');
      }
    }
  }

  getCookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  async makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const cookieHeader = this.getCookieHeader();
      
      if (cookieHeader) {
        headers['Cookie'] = cookieHeader;
      }

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: method,
        headers: headers
      };

      this.log(`${method} ${url.href}`, 'debug');

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let body = '';
        
        this.parseCookies(res.headers);
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          const response = {
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: body,
            url: url.href
          };
          
          this.responses.push(response);
          this.log(`Response: ${res.statusCode} ${res.statusMessage}`, 'debug');
          
          resolve(response);
        });
      });

      req.on('error', (err) => {
        this.log(`Request error: ${err.message}`, 'error');
        reject(err);
      });

      if (data) {
        req.write(data);
      }
      
      req.end();
      
      this.requests.push({
        method,
        url: path,
        data,
        headers,
        timestamp: new Date()
      });
    });
  }

  async testCompleteAuthenticationFlow() {
    this.log('Starting comprehensive authentication flow test', 'info');
    
    try {
      // Test 1: Check server availability
      this.log('Test 1: Server availability check', 'info');
      const healthCheck = await this.makeRequest('GET', '/api/auth/session');
      if (healthCheck.statusCode === 200) {
        this.log('Server is responding correctly', 'success');
      } else {
        this.log(`Server responded with ${healthCheck.statusCode}`, 'warning');
      }

      // Test 2: Check initial redirect behavior
      this.log('Test 2: Protected page redirect check', 'info');
      const protectedPageCheck = await this.makeRequest('GET', '/admin/suppliers');
      if (protectedPageCheck.statusCode === 307 || protectedPageCheck.statusCode === 302) {
        const redirectLocation = protectedPageCheck.headers.location;
        this.log(`Correctly redirected to: ${redirectLocation}`, 'success');
      } else {
        this.log(`Unexpected response for protected page: ${protectedPageCheck.statusCode}`, 'error');
      }

      // Test 3: Login page accessibility
      this.log('Test 3: Login page accessibility', 'info');
      const loginPageCheck = await this.makeRequest('GET', '/admin/login');
      if (loginPageCheck.statusCode === 200) {
        this.log('Login page is accessible', 'success');
        
        // Check if login page contains expected elements
        const hasEmailInput = loginPageCheck.body.includes('input') && 
                             (loginPageCheck.body.includes('email') || loginPageCheck.body.includes('Email'));
        const hasPasswordInput = loginPageCheck.body.includes('password') || 
                               loginPageCheck.body.includes('Password');
        const hasSubmitButton = loginPageCheck.body.includes('submit') || 
                              loginPageCheck.body.includes('Sign in');
        
        if (hasEmailInput && hasPasswordInput && hasSubmitButton) {
          this.log('Login form elements detected in HTML', 'success');
        } else {
          this.log('Some login form elements may be missing', 'warning');
        }
      } else {
        this.log(`Login page returned ${loginPageCheck.statusCode}`, 'error');
      }

      // Test 4: CSRF token acquisition
      this.log('Test 4: CSRF token acquisition', 'info');
      const csrfResponse = await this.makeRequest('GET', '/api/auth/csrf');
      if (csrfResponse.statusCode === 200) {
        try {
          const csrfData = JSON.parse(csrfResponse.body);
          const csrfToken = csrfData.csrfToken;
          if (csrfToken) {
            this.log(`CSRF token acquired: ${csrfToken.substring(0, 20)}...`, 'success');
          } else {
            this.log('CSRF token not found in response', 'error');
            return;
          }
        } catch (e) {
          this.log(`Failed to parse CSRF response: ${e.message}`, 'error');
          return;
        }
      } else {
        this.log(`CSRF endpoint returned ${csrfResponse.statusCode}`, 'error');
        return;
      }

      // Test 5: Authentication attempt
      this.log('Test 5: Authentication with admin credentials', 'info');
      const csrfData = JSON.parse(csrfResponse.body);
      const csrfToken = csrfData.csrfToken;
      
      const authData = new URLSearchParams({
        email: 'admin@monito-web.com',
        password: 'admin123',
        csrfToken: csrfToken,
        callbackUrl: '/admin',
        json: 'true'
      }).toString();

      const authResponse = await this.makeRequest('POST', '/api/auth/callback/credentials', authData, {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(authData)
      });

      if (authResponse.statusCode === 200) {
        try {
          const authResult = JSON.parse(authResponse.body);
          if (authResult.url) {
            this.log(`Authentication successful! Redirect URL: ${authResult.url}`, 'success');
          } else if (authResult.error) {
            this.log(`Authentication failed: ${authResult.error}`, 'error');
          } else {
            this.log(`Unexpected auth response: ${authResponse.body}`, 'warning');
          }
        } catch (e) {
          this.log(`Failed to parse auth response: ${authResponse.body}`, 'error');
        }
      } else {
        this.log(`Authentication endpoint returned ${authResponse.statusCode}`, 'error');
      }

      // Test 6: Session validation
      this.log('Test 6: Session validation', 'info');
      const sessionResponse = await this.makeRequest('GET', '/api/auth/session');
      if (sessionResponse.statusCode === 200) {
        try {
          const sessionData = JSON.parse(sessionResponse.body);
          if (sessionData.user) {
            this.log(`Valid session found: ${sessionData.user.email} (${sessionData.user.role})`, 'success');
          } else {
            this.log('No active session found', 'warning');
          }
        } catch (e) {
          this.log(`Failed to parse session response: ${sessionResponse.body}`, 'error');
        }
      }

      // Test 7: Access protected resource with session
      this.log('Test 7: Access protected resource with session', 'info');
      const protectedAccess = await this.makeRequest('GET', '/admin/suppliers');
      if (protectedAccess.statusCode === 200) {
        this.log('Successfully accessed protected resource', 'success');
      } else if (protectedAccess.statusCode === 307 || protectedAccess.statusCode === 302) {
        this.log('Still being redirected - session may not be working', 'warning');
      } else {
        this.log(`Unexpected response accessing protected resource: ${protectedAccess.statusCode}`, 'error');
      }

      // Test 8: Alternative credentials test
      this.log('Test 8: Testing manager credentials', 'info');
      
      // Clear cookies for new session
      const originalCookies = new Map(this.cookies);
      this.cookies.clear();
      
      // Get new CSRF token
      const csrfResponse2 = await this.makeRequest('GET', '/api/auth/csrf');
      const csrfData2 = JSON.parse(csrfResponse2.body);
      const csrfToken2 = csrfData2.csrfToken;
      
      const managerAuthData = new URLSearchParams({
        email: 'manager@monito-web.com',
        password: 'manager123',
        csrfToken: csrfToken2,
        callbackUrl: '/admin',
        json: 'true'
      }).toString();

      const managerAuthResponse = await this.makeRequest('POST', '/api/auth/callback/credentials', managerAuthData, {
        'Content-Type': 'application/x-www-form-urlencoded'
      });

      if (managerAuthResponse.statusCode === 200) {
        const managerAuthResult = JSON.parse(managerAuthResponse.body);
        if (managerAuthResult.url) {
          this.log('Manager authentication also successful', 'success');
        } else {
          this.log('Manager authentication failed', 'warning');
        }
      }

      // Test 9: Database verification
      this.log('Test 9: Database user verification', 'info');
      try {
        const { PrismaClient } = require('@prisma/client');
        const prisma = new PrismaClient();
        
        const users = await prisma.user.findMany({
          select: { email: true, role: true, isActive: true }
        });
        
        this.log(`Database contains ${users.length} users:`, 'success');
        users.forEach(user => {
          this.log(`  - ${user.email} (${user.role}, active: ${user.isActive})`, 'info');
        });
        
        await prisma.$disconnect();
      } catch (error) {
        this.log(`Database check failed: ${error.message}`, 'error');
      }

      // Generate summary report
      this.generateSummaryReport();

    } catch (error) {
      this.log(`Test suite failed: ${error.message}`, 'error');
    }
  }

  generateSummaryReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 COMPREHENSIVE AUTHENTICATION DIAGNOSIS REPORT');
    console.log('='.repeat(80));
    
    console.log('\n📊 TEST RESULTS SUMMARY:');
    
    // Count success/error responses
    const successfulRequests = this.responses.filter(r => r.statusCode >= 200 && r.statusCode < 300).length;
    const redirectRequests = this.responses.filter(r => r.statusCode >= 300 && r.statusCode < 400).length;
    const errorRequests = this.responses.filter(r => r.statusCode >= 400).length;
    
    console.log(`  ✅ Successful requests: ${successfulRequests}`);
    console.log(`  🔄 Redirect requests: ${redirectRequests}`);
    console.log(`  ❌ Error requests: ${errorRequests}`);
    
    console.log('\n🔍 KEY FINDINGS:');
    
    // Check for authentication success
    const authSuccessful = this.responses.some(r => 
      r.url.includes('/api/auth/callback/credentials') && 
      r.statusCode === 200 && 
      r.body.includes('"url"')
    );
    
    if (authSuccessful) {
      console.log('  ✅ Backend authentication is working correctly');
    } else {
      console.log('  ❌ Backend authentication appears to be failing');
    }
    
    // Check for session establishment
    const sessionEstablished = this.responses.some(r =>
      r.url.includes('/api/auth/session') &&
      r.statusCode === 200 &&
      r.body.includes('"user"')
    );
    
    if (sessionEstablished) {
      console.log('  ✅ Session management is working');
    } else {
      console.log('  ❌ Session management may have issues');
    }
    
    console.log('\n🔧 SPECIFIC RECOMMENDATIONS:');
    console.log('  1. ✅ Add NEXTAUTH_SECRET to environment (COMPLETED)');
    console.log('  2. 🔍 Check browser console for JavaScript errors during login');
    console.log('  3. 🔍 Verify client-side form submission is working');
    console.log('  4. 🔍 Test with browser developer tools network tab');
    console.log('  5. 🔍 Clear browser cache and cookies, then retry');
    console.log('  6. 🔍 Try using different browsers (Chrome, Firefox, Safari)');
    console.log('  7. 🔍 Disable browser extensions that might interfere');
    
    console.log('\n🎯 NEXT STEPS FOR DEBUGGING:');
    console.log('  1. Open browser developer tools (F12)');
    console.log('  2. Go to Network tab');
    console.log('  3. Navigate to http://209.38.85.196:3000/admin/login');
    console.log('  4. Enter credentials and submit');
    console.log('  5. Check for:');
    console.log('     - JavaScript errors in Console tab');
    console.log('     - Failed network requests in Network tab');
    console.log('     - Response bodies for error messages');
    console.log('     - Cookie setting/reading issues');
    
    console.log('\n' + '='.repeat(80));
  }
}

// Run the comprehensive test
const authDebugger = new AuthenticationDebugger('http://209.38.85.196:3000');
authDebugger.testCompleteAuthenticationFlow();