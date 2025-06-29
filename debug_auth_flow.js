#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URLSearchParams } = require('url');

// Allow self-signed certificates for testing
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

class AuthTester {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.cookies = new Map();
  }

  // Parse cookies from response headers and store them
  parseCookies(headers) {
    const setCookieHeaders = headers['set-cookie'] || [];
    for (const cookieHeader of setCookieHeaders) {
      const [cookiePart] = cookieHeader.split(';');
      const [name, value] = cookiePart.split('=');
      if (name && value) {
        this.cookies.set(name.trim(), value.trim());
        console.log(`🍪 Cookie stored: ${name.trim()}=${value.trim()}`);
      }
    }
  }

  // Get cookies as a string for request headers
  getCookieHeader() {
    const cookieArray = [];
    for (const [name, value] of this.cookies.entries()) {
      cookieArray.push(`${name}=${value}`);
    }
    return cookieArray.join('; ');
  }

  // Make HTTP request with cookies
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

      console.log(`\n📤 ${method} ${url.href}`);
      console.log(`Headers:`, headers);

      const client = url.protocol === 'https:' ? https : http;
      const req = client.request(options, (res) => {
        let body = '';
        
        // Parse cookies from response
        this.parseCookies(res.headers);
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          console.log(`📥 Response: ${res.statusCode} ${res.statusMessage}`);
          console.log(`Response headers:`, res.headers);
          
          if (body.length < 1000) {
            console.log(`Response body:`, body);
          } else {
            console.log(`Response body: ${body.length} characters (truncated)`);
          }
          
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            body: body
          });
        });
      });

      req.on('error', (err) => {
        console.error(`❌ Request error:`, err);
        reject(err);
      });

      if (data) {
        req.write(data);
      }
      
      req.end();
    });
  }

  async testFullAuthFlow() {
    console.log('🚀 Starting authentication flow test...\n');

    try {
      // Step 1: Get initial page to check redirect
      console.log('=== STEP 1: Access protected page ===');
      const initialResponse = await this.makeRequest('GET', '/admin/suppliers');
      
      if (initialResponse.statusCode === 307 || initialResponse.statusCode === 302) {
        console.log('✅ Correctly redirected to login');
      }

      // Step 2: Get CSRF token
      console.log('\n=== STEP 2: Get CSRF token ===');
      const csrfResponse = await this.makeRequest('GET', '/api/auth/csrf');
      const csrfData = JSON.parse(csrfResponse.body);
      const csrfToken = csrfData.csrfToken;
      console.log(`🔐 CSRF Token: ${csrfToken}`);

      // Step 3: Test authentication with admin credentials
      console.log('\n=== STEP 3: Authenticate with admin@monito-web.com ===');
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

      console.log(`Auth response: ${authResponse.body}`);
      
      if (authResponse.body.includes('"url"')) {
        console.log('✅ Authentication successful');
        
        // Step 4: Try to access protected page with session
        console.log('\n=== STEP 4: Access protected page with session ===');
        const protectedResponse = await this.makeRequest('GET', '/admin/suppliers');
        
        if (protectedResponse.statusCode === 200) {
          console.log('✅ Successfully accessed protected page');
        } else {
          console.log(`❌ Failed to access protected page: ${protectedResponse.statusCode}`);
        }
        
      } else {
        console.log('❌ Authentication failed');
        console.log('Response:', authResponse.body);
      }

      // Step 5: Test with manager credentials
      console.log('\n=== STEP 5: Test with manager@monito-web.com ===');
      // Clear session first
      this.cookies.clear();
      
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
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(managerAuthData)
      });

      console.log(`Manager auth response: ${managerAuthResponse.body}`);

      // Step 6: Test session info
      console.log('\n=== STEP 6: Get session info ===');
      const sessionResponse = await this.makeRequest('GET', '/api/auth/session');
      console.log(`Session: ${sessionResponse.body}`);

    } catch (error) {
      console.error('💥 Test failed:', error);
    }
  }
}

// Run the test
const tester = new AuthTester('http://209.38.85.196:3000');
tester.testFullAuthFlow();