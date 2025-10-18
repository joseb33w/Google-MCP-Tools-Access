import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { GoogleDriveService } from './google-drive-service.js';
import { google } from 'googleapis';

// Extend Request type to include userTokens
interface AuthenticatedRequest extends Request {
  userTokens?: any;
}

const app = express();
const port = process.env.PORT || 8080;

// CORS configuration for web app
app.use(cors({
  origin: [
    'https://google-mcp-tools-access-production.up.railway.app', // Railway domain
    'http://localhost:3000', // Local development
    'https://triamit.com', // Your custom domain
    'https://www.triamit.com' // Your custom domain with www
  ],
  credentials: true
}));
app.use(express.json());

// Store user tokens (in production, use Redis or database)
const userTokens = new Map();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'google-drive-mcp',
    timestamp: new Date().toISOString()
  });
});

// OAuth endpoints for user authentication
app.get('/auth/google', (req, res) => {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${req.protocol}://${req.get('host')}/auth/callback`
  );

  const scopes = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/docs',
    'https://www.googleapis.com/auth/userinfo.profile',
    'openid'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    if (!code) {
      return res.status(400).json({ error: 'No authorization code received' });
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${req.protocol}://${req.get('host')}/auth/callback`
    );

    const { tokens } = await oauth2Client.getToken(code as string);
    
    // Generate a session ID for the user
    const sessionId = Math.random().toString(36).substring(2, 15);
    userTokens.set(sessionId, tokens);

    // Redirect to frontend with session ID
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}?session=${sessionId}`);
    
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// Middleware to validate user tokens
const authenticateUser = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId || !userTokens.has(sessionId)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  req.userTokens = userTokens.get(sessionId);
  next();
};

// MCP endpoint with user authentication
app.post('/mcp', authenticateUser, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { jsonrpc, id, method, params } = req.body;

    if (method === 'tools/list') {
      const tools = [
        // Google Docs API Tools
        { name: 'docs_create_document', description: 'Create a new Google Doc' },
        { name: 'docs_get_document', description: 'Get the content of a Google Doc' },
        { name: 'docs_append_text', description: 'Append text to a Google Doc' },
        { name: 'docs_replace_text', description: 'Find and replace text in a Google Doc' },
        { name: 'docs_list_documents', description: 'List your Google Docs' },
        { name: 'docs_delete_document', description: 'Delete a Google Doc' },
        { name: 'docs_export_pdf', description: 'Export a Google Doc as PDF' },
        // Google Drive API Tools
        { name: 'drive_list_files', description: 'List all files in Google Drive' },
        { name: 'drive_get_file', description: 'Get file metadata and content' },
        { name: 'drive_create_file', description: 'Create a new file in Google Drive' },
        { name: 'drive_update_file', description: 'Update file content or metadata' },
        { name: 'drive_delete_file', description: 'Delete a file from Google Drive' },
        { name: 'drive_copy_file', description: 'Copy a file in Google Drive' },
        { name: 'drive_move_file', description: 'Move a file to different folders' },
        { name: 'drive_list_permissions', description: 'List file permissions' },
        { name: 'drive_create_permission', description: 'Share a file with users' },
        { name: 'drive_delete_permission', description: 'Remove file permissions' },
        { name: 'drive_list_revisions', description: 'List file revisions/versions' },
        { name: 'drive_get_revision', description: 'Get specific file revision' },
        { name: 'drive_delete_revision', description: 'Delete a file revision' },
        { name: 'drive_list_comments', description: 'List file comments' },
        { name: 'drive_create_comment', description: 'Add a comment to a file' },
        { name: 'drive_delete_comment', description: 'Delete a file comment' },
        { name: 'drive_list_replies', description: 'List replies to a comment' },
        { name: 'drive_create_reply', description: 'Reply to a comment' },
        { name: 'drive_delete_reply', description: 'Delete a reply to a comment' },
      ];

      res.json({
        jsonrpc: '2.0',
        id,
        result: { tools }
      });
    } else if (method === 'tools/call') {
      const { name, arguments: args } = params;
      
      // Create service with user-specific tokens
      const service = new GoogleDriveService();
      // Override the service's OAuth tokens with user's tokens
      service.setUserTokens(req.userTokens);

      let result;
      switch (name) {
        // Google Docs API
        case 'docs_create_document':
          result = await service.createDocument(args?.title);
          break;
        case 'docs_get_document':
          result = await service.getDocument(args?.documentId);
          break;
        case 'docs_append_text':
          result = await service.appendText(args?.documentId, args?.text);
          break;
        case 'docs_replace_text':
          result = await service.replaceText(args?.documentId, args?.findText, args?.replaceWithText);
          break;
        case 'docs_list_documents':
          result = await service.listDocuments(args?.maxResults);
          break;
        case 'docs_delete_document':
          result = await service.deleteDocument(args?.documentId);
          break;
        case 'docs_export_pdf':
          result = await service.exportPDF(args?.documentId, args?.outputPath);
          break;
        
        // Google Drive API
        case 'drive_list_files':
          result = await service.listDriveFiles(args?.maxResults, args?.mimeType, args?.query, args?.orderBy);
          break;
        case 'drive_get_file':
          result = await service.getDriveFile(args?.fileId, args?.fields);
          break;
        case 'drive_create_file':
          result = await service.createDriveFile(args?.name, args?.mimeType, args?.content, args?.parents);
          break;
        case 'drive_update_file':
          result = await service.updateDriveFile(args?.fileId, args?.name, args?.content, args?.addParents, args?.removeParents);
          break;
        case 'drive_delete_file':
          result = await service.deleteDriveFile(args?.fileId);
          break;
        case 'drive_copy_file':
          result = await service.copyDriveFile(args?.fileId, args?.name, args?.parents);
          break;
        case 'drive_move_file':
          result = await service.moveDriveFile(args?.fileId, args?.addParents, args?.removeParents);
          break;
        
        // Permissions
        case 'drive_list_permissions':
          result = await service.listDrivePermissions(args?.fileId);
          break;
        case 'drive_create_permission':
          result = await service.createDrivePermission(args?.fileId, args?.emailAddress, args?.role, args?.type);
          break;
        case 'drive_delete_permission':
          result = await service.deleteDrivePermission(args?.fileId, args?.permissionId);
          break;
        
        // Revisions
        case 'drive_list_revisions':
          result = await service.listDriveRevisions(args?.fileId);
          break;
        case 'drive_get_revision':
          result = await service.getDriveRevision(args?.fileId, args?.revisionId);
          break;
        case 'drive_delete_revision':
          result = await service.deleteDriveRevision(args?.fileId, args?.revisionId);
          break;
        
        // Comments
        case 'drive_list_comments':
          result = await service.listDriveComments(args?.fileId, args?.maxResults);
          break;
        case 'drive_create_comment':
          result = await service.createDriveComment(args?.fileId, args?.content, args?.quotedFileContent);
          break;
        case 'drive_delete_comment':
          result = await service.deleteDriveComment(args?.fileId, args?.commentId);
          break;
        
        // Replies
        case 'drive_list_replies':
          result = await service.listDriveReplies(args?.fileId, args?.commentId);
          break;
        case 'drive_create_reply':
          result = await service.createDriveReply(args?.fileId, args?.commentId, args?.content);
          break;
        case 'drive_delete_reply':
          result = await service.deleteDriveReply(args?.fileId, args?.commentId, args?.replyId);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      res.json({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
        }
      });
    } else {
      res.status(400).json({
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: 'Method not found' }
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body.id,
      error: { code: -32603, message: errorMessage }
    });
  }
});

app.listen(port, () => {
  console.log(`Google Drive MCP Server running on port ${port}`);
  console.log(`MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`Health check: http://localhost:${port}/health`);
});