import { google } from 'googleapis';
import http from 'http';
import { URL } from 'url';
import open from 'open';
import readline from 'readline';

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/docs',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid',
  'https://www.googleapis.com/auth/documents',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
  'https://www.googleapis.com/auth/drive.apps',
  'https://www.googleapis.com/auth/activity',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/gmail.readonly'
];

const PORT = 3002;
const REDIRECT_URI = `http://localhost:3002/oauth2callback`;

// OAuth credentials - set these as environment variables or replace with your own
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE';

async function setupOAuth() {
  console.log('🔐 Google Drive MCP - OAuth 2.0 Setup\n');
  console.log('📋 Using OAuth credentials...\n');

  // Check if credentials are properly set
  if (CLIENT_ID === 'YOUR_CLIENT_ID_HERE' || CLIENT_SECRET === 'YOUR_CLIENT_SECRET_HERE') {
    console.error('❌ Please set your OAuth credentials!');
    console.error('   Either set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables');
    console.error('   Or edit quick-oauth-setup.js and replace YOUR_CLIENT_ID_HERE and YOUR_CLIENT_SECRET_HERE');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    CLIENT_ID,
    CLIENT_SECRET,
    REDIRECT_URI
  );

  // Generate auth URL
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent'
  });

  console.log('🌐 Opening browser for authentication...\n');
  console.log('If the browser doesn\'t open automatically, visit this URL:\n');
  console.log(authUrl + '\n');

  // Start local server to receive the callback
  const server = http.createServer(async (req, res) => {
    if (req.url.startsWith('/oauth2callback')) {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get('code');

      if (code) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html>
            <body style="font-family: Arial; padding: 40px; text-align: center;">
              <h1>✅ Authentication Successful!</h1>
              <p>You can close this window and return to the terminal.</p>
            </body>
          </html>
        `);

        try {
          // Exchange code for tokens
          const { tokens } = await oauth2Client.getToken(code);
          
          console.log('\n✅ Authentication successful!\n');
          
          // Create .env file
          const fs = await import('fs');
          const envContent = `# Google Drive MCP OAuth 2.0 Configuration
GOOGLE_CLIENT_ID=${CLIENT_ID}
GOOGLE_CLIENT_SECRET=${CLIENT_SECRET}
GOOGLE_REDIRECT_URI=${REDIRECT_URI}
GOOGLE_OAUTH_TOKENS='${JSON.stringify(tokens)}'
`;
          
          fs.writeFileSync('.env', envContent);
          console.log('✅ Created .env file with your credentials!\n');
          console.log('🎉 Setup complete! You can now use the MCP server.\n');
          console.log('🚀 Run: npm start\n');
          
        } catch (error) {
          console.error('❌ Error getting tokens:', error.message);
        }

        server.close();
        process.exit(0);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('No authorization code received');
        server.close();
        process.exit(1);
      }
    }
  });

  server.listen(PORT, () => {
    console.log(`🔊 Local server listening on port ${PORT}...\n`);
    // Open browser
    open(authUrl).catch(() => {
      console.log('⚠️  Could not open browser automatically.\n');
    });
  });
}

setupOAuth().catch(error => {
  console.error('❌ Setup failed:', error);
  process.exit(1);
});
