import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { GoogleDriveService } from './google-drive-service.js';

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'google-drive-mcp',
    timestamp: new Date().toISOString()
  });
});

// MCP endpoint
app.post('/mcp', async (req, res) => {
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
      const service = new GoogleDriveService();

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