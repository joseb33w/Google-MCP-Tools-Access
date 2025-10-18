#!/usr/bin/env node

import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { GoogleDriveService } from './google-drive-service.js';

let googleDriveService: GoogleDriveService | null = null;

function getGoogleDriveService() {
  if (!googleDriveService) {
    googleDriveService = new GoogleDriveService();
  }
  return googleDriveService;
}

const server = new Server(
  {
    name: 'google-drive-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const tools: Tool[] = [
  // Google Docs API Tools
  {
    name: 'docs_create_document',
    description: 'Create a new Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Document title' },
      },
      required: ['title'],
    },
  },
  {
    name: 'docs_get_document',
    description: 'Get the content of a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Doc ID' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'docs_append_text',
    description: 'Append text to a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Doc ID' },
        text: { type: 'string', description: 'Text to append' },
      },
      required: ['documentId', 'text'],
    },
  },
  {
    name: 'docs_replace_text',
    description: 'Find and replace text in a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Doc ID' },
        findText: { type: 'string', description: 'Text to find' },
        replaceWithText: { type: 'string', description: 'Text to replace with' },
      },
      required: ['documentId', 'findText', 'replaceWithText'],
    },
  },
  {
    name: 'docs_list_documents',
    description: 'List your Google Docs',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', description: 'Maximum number of documents to return (default: 10)', default: 10 },
      },
    },
  },
  {
    name: 'docs_delete_document',
    description: 'Delete a Google Doc',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Doc ID to delete' },
      },
      required: ['documentId'],
    },
  },
  {
    name: 'docs_export_pdf',
    description: 'Export a Google Doc as PDF',
    inputSchema: {
      type: 'object',
      properties: {
        documentId: { type: 'string', description: 'Google Doc ID' },
        outputPath: { type: 'string', description: 'Path to save the PDF file' },
      },
      required: ['documentId', 'outputPath'],
    },
  },
  // Google Drive API Tools
  {
    name: 'drive_list_files',
    description: 'List all files in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        maxResults: { type: 'number', description: 'Maximum number of files to return (default: 50)', default: 50 },
        mimeType: { type: 'string', description: 'Filter by MIME type (optional)' },
        query: { type: 'string', description: 'Custom search query (optional)' },
        orderBy: { type: 'string', description: 'Order results by field (default: modifiedTime desc)', default: 'modifiedTime desc' },
      },
    },
  },
  {
    name: 'drive_get_file',
    description: 'Get file metadata and content',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        fields: { type: 'string', description: 'Fields to return (optional)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_create_file',
    description: 'Create a new file in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'File name' },
        mimeType: { type: 'string', description: 'MIME type of the file' },
        content: { type: 'string', description: 'File content (optional)' },
        parents: { type: 'array', items: { type: 'string' }, description: 'Parent folder IDs (optional)' },
      },
      required: ['name', 'mimeType'],
    },
  },
  {
    name: 'drive_update_file',
    description: 'Update file content or metadata',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        name: { type: 'string', description: 'New file name (optional)' },
        content: { type: 'string', description: 'New file content (optional)' },
        addParents: { type: 'array', items: { type: 'string' }, description: 'Add to these folders (optional)' },
        removeParents: { type: 'array', items: { type: 'string' }, description: 'Remove from these folders (optional)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_delete_file',
    description: 'Delete a file from Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_copy_file',
    description: 'Copy a file in Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Source file ID' },
        name: { type: 'string', description: 'Name for the copied file (optional)' },
        parents: { type: 'array', items: { type: 'string' }, description: 'Destination folder IDs (optional)' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_move_file',
    description: 'Move a file to different folders',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'File ID to move' },
        addParents: { type: 'array', items: { type: 'string' }, description: 'Add to these folders' },
        removeParents: { type: 'array', items: { type: 'string' }, description: 'Remove from these folders' },
      },
      required: ['fileId', 'addParents', 'removeParents'],
    },
  },
  // Permissions
  {
    name: 'drive_list_permissions',
    description: 'List file permissions',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_create_permission',
    description: 'Share a file with users',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        emailAddress: { type: 'string', description: 'Email address to share with' },
        role: { type: 'string', enum: ['reader', 'writer', 'commenter', 'owner'], description: 'Permission role' },
        type: { type: 'string', enum: ['user', 'group', 'domain', 'anyone'], description: 'Permission type' },
      },
      required: ['fileId', 'role', 'type'],
    },
  },
  {
    name: 'drive_delete_permission',
    description: 'Remove file permissions',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        permissionId: { type: 'string', description: 'Permission ID to remove' },
      },
      required: ['fileId', 'permissionId'],
    },
  },
  // Revisions
  {
    name: 'drive_list_revisions',
    description: 'List file revisions/versions',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_get_revision',
    description: 'Get specific file revision',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        revisionId: { type: 'string', description: 'Revision ID' },
      },
      required: ['fileId', 'revisionId'],
    },
  },
  {
    name: 'drive_delete_revision',
    description: 'Delete a file revision',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        revisionId: { type: 'string', description: 'Revision ID to delete' },
      },
      required: ['fileId', 'revisionId'],
    },
  },
  // Comments
  {
    name: 'drive_list_comments',
    description: 'List file comments',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        maxResults: { type: 'number', description: 'Maximum number of comments (default: 100)', default: 100 },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'drive_create_comment',
    description: 'Add a comment to a file',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        content: { type: 'string', description: 'Comment content' },
        quotedFileContent: { type: 'string', description: 'Quoted text from the file (optional)' },
      },
      required: ['fileId', 'content'],
    },
  },
  {
    name: 'drive_delete_comment',
    description: 'Delete a file comment',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        commentId: { type: 'string', description: 'Comment ID to delete' },
      },
      required: ['fileId', 'commentId'],
    },
  },
  // Replies
  {
    name: 'drive_list_replies',
    description: 'List replies to a comment',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        commentId: { type: 'string', description: 'Comment ID' },
      },
      required: ['fileId', 'commentId'],
    },
  },
  {
    name: 'drive_create_reply',
    description: 'Reply to a comment',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        commentId: { type: 'string', description: 'Comment ID to reply to' },
        content: { type: 'string', description: 'Reply content' },
      },
      required: ['fileId', 'commentId', 'content'],
    },
  },
  {
    name: 'drive_delete_reply',
    description: 'Delete a reply to a comment',
    inputSchema: {
      type: 'object',
      properties: {
        fileId: { type: 'string', description: 'Google Drive file ID' },
        commentId: { type: 'string', description: 'Comment ID' },
        replyId: { type: 'string', description: 'Reply ID to delete' },
      },
      required: ['fileId', 'commentId', 'replyId'],
    },
  },
];

const toolsResponse = { tools };

server.setRequestHandler(ListToolsRequestSchema, async () => toolsResponse);

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // Google Docs API
      case 'docs_create_document':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().createDocument(args?.title as string), null, 2) }] };
      case 'docs_get_document':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().getDocument(args?.documentId as string), null, 2) }] };
      case 'docs_append_text':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().appendText(args?.documentId as string, args?.text as string), null, 2) }] };
      case 'docs_replace_text':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().replaceText(args?.documentId as string, args?.findText as string, args?.replaceWithText as string), null, 2) }] };
      case 'docs_list_documents':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().listDocuments(args?.maxResults as number), null, 2) }] };
      case 'docs_delete_document':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().deleteDocument(args?.documentId as string), null, 2) }] };
      case 'docs_export_pdf':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().exportPDF(args?.documentId as string, args?.outputPath as string), null, 2) }] };
      
      // Google Drive API
      case 'drive_list_files':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().listDriveFiles(args?.maxResults as number, args?.mimeType as string, args?.query as string, args?.orderBy as string), null, 2) }] };
      case 'drive_get_file':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().getDriveFile(args?.fileId as string, args?.fields as string), null, 2) }] };
      case 'drive_create_file':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().createDriveFile(args?.name as string, args?.mimeType as string, args?.content as string, args?.parents as string[]), null, 2) }] };
      case 'drive_update_file':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().updateDriveFile(args?.fileId as string, args?.name as string, args?.content as string, args?.addParents as string[], args?.removeParents as string[]), null, 2) }] };
      case 'drive_delete_file':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().deleteDriveFile(args?.fileId as string), null, 2) }] };
      case 'drive_copy_file':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().copyDriveFile(args?.fileId as string, args?.name as string, args?.parents as string[]), null, 2) }] };
      case 'drive_move_file':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().moveDriveFile(args?.fileId as string, args?.addParents as string[], args?.removeParents as string[]), null, 2) }] };
      
      // Permissions
      case 'drive_list_permissions':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().listDrivePermissions(args?.fileId as string), null, 2) }] };
      case 'drive_create_permission':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().createDrivePermission(args?.fileId as string, args?.emailAddress as string, args?.role as string, args?.type as string), null, 2) }] };
      case 'drive_delete_permission':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().deleteDrivePermission(args?.fileId as string, args?.permissionId as string), null, 2) }] };
      
      // Revisions
      case 'drive_list_revisions':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().listDriveRevisions(args?.fileId as string), null, 2) }] };
      case 'drive_get_revision':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().getDriveRevision(args?.fileId as string, args?.revisionId as string), null, 2) }] };
      case 'drive_delete_revision':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().deleteDriveRevision(args?.fileId as string, args?.revisionId as string), null, 2) }] };
      
      // Comments
      case 'drive_list_comments':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().listDriveComments(args?.fileId as string, args?.maxResults as number), null, 2) }] };
      case 'drive_create_comment':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().createDriveComment(args?.fileId as string, args?.content as string, args?.quotedFileContent as string), null, 2) }] };
      case 'drive_delete_comment':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().deleteDriveComment(args?.fileId as string, args?.commentId as string), null, 2) }] };
      
      // Replies
      case 'drive_list_replies':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().listDriveReplies(args?.fileId as string, args?.commentId as string), null, 2) }] };
      case 'drive_create_reply':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().createDriveReply(args?.fileId as string, args?.commentId as string, args?.content as string), null, 2) }] };
      case 'drive_delete_reply':
        return { content: [{ type: 'text', text: JSON.stringify(await getGoogleDriveService().deleteDriveReply(args?.fileId as string, args?.commentId as string, args?.replyId as string), null, 2) }] };

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: 'text', text: `Error: ${errorMessage}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Google Drive MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});