import { google } from 'googleapis';

export class GoogleDriveService {
  private drive: any;
  private docs: any;
  private oauth2Client: any;
  private initialized = false;

  private readonly SCOPES = [
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

  private async initializeAuth() {
    if (this.initialized) return;

    // OAuth 2.0 authentication
    if (process.env.GOOGLE_OAUTH_TOKENS) {
      try {
        const tokens = JSON.parse(process.env.GOOGLE_OAUTH_TOKENS);
        this.oauth2Client = new google.auth.OAuth2(
          process.env.GOOGLE_CLIENT_ID,
          process.env.GOOGLE_CLIENT_SECRET,
          process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
        );
        this.oauth2Client.setCredentials(tokens);
      } catch (error) {
        throw new Error('Invalid GOOGLE_OAUTH_TOKENS format');
      }
    } else {
      throw new Error('No OAuth credentials found. Please run the authentication setup first.');
    }

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    this.docs = google.docs({ version: 'v1', auth: this.oauth2Client });
    this.initialized = true;
  }

  private async ensureAuthenticated() {
    if (!this.initialized) {
      await this.initializeAuth();
    }
    // Refresh token if expired (only for OAuth2, not service accounts)
    if (this.oauth2Client.credentials?.expiry_date && this.oauth2Client.credentials.expiry_date < Date.now() + 60 * 1000) {
      await this.oauth2Client.refreshAccessToken();
    }
  }

  // Method to set user-specific tokens (for multi-user support)
  setUserTokens(tokens: any) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/oauth2callback'
    );
    this.oauth2Client.setCredentials(tokens);
    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    this.docs = google.docs({ version: 'v1', auth: this.oauth2Client });
    this.initialized = true;
  }

  // Google Docs API Methods
  async createDocument(title: string) {
    await this.ensureAuthenticated();
    const response = await this.docs.documents.create({
      requestBody: { title },
    });
    return {
      documentId: response.data.documentId,
      title: response.data.title,
      url: `https://docs.google.com/document/d/${response.data.documentId}/edit`,
    };
  }

  async getDocument(documentId: string) {
    await this.ensureAuthenticated();
    const response = await this.docs.documents.get({ documentId });
    return {
      documentId: response.data.documentId,
      title: response.data.title,
      content: response.data.body?.content?.map((item: any) => ({
        type: item.paragraph ? 'paragraph' : 'other',
        text: item.paragraph?.elements?.map((el: any) => el.textRun?.content || '').join('') || '',
      })),
    };
  }

  async appendText(documentId: string, text: string) {
    await this.ensureAuthenticated();
    const requests = [{
      insertText: {
        location: { endOfSegmentLocation: {} },
        text,
      },
    }];
    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
    return { documentId, message: 'Text appended successfully' };
  }

  async replaceText(documentId: string, findText: string, replaceWithText: string) {
    await this.ensureAuthenticated();
    const requests = [{
      replaceAllText: {
        replaceText: replaceWithText,
        containsText: { text: findText, matchCase: false },
      },
    }];
    await this.docs.documents.batchUpdate({
      documentId,
      requestBody: { requests },
    });
    return { documentId, message: 'Text replaced successfully' };
  }

  async listDocuments(maxResults = 10) {
    await this.ensureAuthenticated();
    const response = await this.drive.files.list({
      q: "mimeType='application/vnd.google-apps.document'",
      spaces: 'drive',
      fields: 'files(id, name, createdTime, modifiedTime)',
      pageSize: maxResults,
    });
    return {
      totalDocs: response.data.files?.length || 0,
      documents: response.data.files?.map((file: any) => ({
        documentId: file.id,
        title: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        url: `https://docs.google.com/document/d/${file.id}/edit`,
      })),
    };
  }

  async deleteDocument(documentId: string) {
    await this.ensureAuthenticated();
    await this.drive.files.delete({ fileId: documentId });
    return { success: true, documentId, message: 'Document deleted successfully' };
  }

  async exportPDF(documentId: string, outputPath: string) {
    await this.ensureAuthenticated();
    const response = await this.drive.files.export(
      { fileId: documentId, mimeType: 'application/pdf' },
      { responseType: 'stream' }
    );
    return new Promise((resolve, reject) => {
      const fs = require('fs');
      const dest = fs.createWriteStream(outputPath);
      response.data
        .on('end', () => resolve({ success: true, documentId, outputPath, message: 'PDF exported successfully' }))
        .on('error', reject)
        .pipe(dest);
    });
  }

  // Google Drive API Methods
  async listDriveFiles(maxResults = 50, mimeType?: string, query?: string, orderBy = 'modifiedTime desc') {
    await this.ensureAuthenticated();
    let searchQuery = "trashed=false";
    if (mimeType) searchQuery += ` and mimeType='${mimeType}'`;
    if (query) searchQuery += ` and name contains '${query}'`;

    const response = await this.drive.files.list({
      q: searchQuery,
      spaces: 'drive',
      fields: 'files(id, name, mimeType, createdTime, modifiedTime, size, webViewLink, parents)',
      pageSize: maxResults,
      orderBy,
    });

    return {
      totalFiles: response.data.files?.length || 0,
      files: response.data.files?.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
        size: file.size,
        webViewLink: file.webViewLink,
        parents: file.parents,
        isGoogleDoc: file.mimeType === 'application/vnd.google-apps.document',
        isGoogleSheet: file.mimeType === 'application/vnd.google-apps.spreadsheet',
        isGoogleSlide: file.mimeType === 'application/vnd.google-apps.presentation',
        isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      })),
    };
  }

  async getDriveFile(fileId: string, fields?: string) {
    await this.ensureAuthenticated();
    const response = await this.drive.files.get({
      fileId,
      fields: fields || 'id,name,mimeType,createdTime,modifiedTime,size,webViewLink,parents,permissions,owners',
    });
    return {
      id: response.data.id,
      name: response.data.name,
      mimeType: response.data.mimeType,
      createdTime: response.data.createdTime,
      modifiedTime: response.data.modifiedTime,
      size: response.data.size,
      webViewLink: response.data.webViewLink,
      parents: response.data.parents,
      permissions: response.data.permissions,
      owners: response.data.owners,
    };
  }

  async createDriveFile(name: string, mimeType: string, content?: string, parents?: string[]) {
    await this.ensureAuthenticated();
    const fileMetadata = { name, parents };
    let response;

    if (content) {
      const media = { mimeType, body: content };
      response = await this.drive.files.create({
        resource: fileMetadata,
        media,
        fields: 'id,name,mimeType,webViewLink',
      });
    } else {
      response = await this.drive.files.create({
        resource: { ...fileMetadata, mimeType },
        fields: 'id,name,mimeType,webViewLink',
      });
    }

    return {
      id: response.data.id,
      name: response.data.name,
      mimeType: response.data.mimeType,
      webViewLink: response.data.webViewLink,
      message: 'File created successfully',
    };
  }

  async updateDriveFile(fileId: string, name?: string, content?: string, addParents?: string[], removeParents?: string[]) {
    await this.ensureAuthenticated();
    const updateData: any = {};
    
    if (name) updateData.name = name;
    if (addParents || removeParents) {
      updateData.addParents = addParents?.join(',');
      updateData.removeParents = removeParents?.join(',');
    }

    let response;
    if (content) {
      const media = { mimeType: 'text/plain', body: content };
      response = await this.drive.files.update({
        fileId,
        resource: updateData,
        media,
        fields: 'id,name,mimeType,webViewLink',
      });
    } else {
      response = await this.drive.files.update({
        fileId,
        resource: updateData,
        fields: 'id,name,mimeType,webViewLink',
      });
    }

    return {
      id: response.data.id,
      name: response.data.name,
      mimeType: response.data.mimeType,
      webViewLink: response.data.webViewLink,
      message: 'File updated successfully',
    };
  }

  async deleteDriveFile(fileId: string) {
    await this.ensureAuthenticated();
    await this.drive.files.delete({ fileId });
    return { fileId, message: 'File deleted successfully' };
  }

  async copyDriveFile(fileId: string, name?: string, parents?: string[]) {
    await this.ensureAuthenticated();
    const copyMetadata: any = {};
    if (name) copyMetadata.name = name;
    if (parents) copyMetadata.parents = parents;

    const response = await this.drive.files.copy({
      fileId,
      resource: copyMetadata,
      fields: 'id,name,mimeType,webViewLink',
    });

    return {
      id: response.data.id,
      name: response.data.name,
      mimeType: response.data.mimeType,
      webViewLink: response.data.webViewLink,
      message: 'File copied successfully',
    };
  }

  async moveDriveFile(fileId: string, addParents: string[], removeParents: string[]) {
    await this.ensureAuthenticated();
    const response = await this.drive.files.update({
      fileId,
      addParents: addParents.join(','),
      removeParents: removeParents.join(','),
      fields: 'id,name,parents',
    });

    return {
      id: response.data.id,
      name: response.data.name,
      parents: response.data.parents,
      message: 'File moved successfully',
    };
  }

  // Permissions
  async listDrivePermissions(fileId: string) {
    await this.ensureAuthenticated();
    const response = await this.drive.permissions.list({
      fileId,
      fields: 'permissions(id,type,role,emailAddress,displayName)',
    });
    return {
      permissions: response.data.permissions?.map((permission: any) => ({
        id: permission.id,
        type: permission.type,
        role: permission.role,
        emailAddress: permission.emailAddress,
        displayName: permission.displayName,
      })) || [],
    };
  }

  async createDrivePermission(fileId: string, emailAddress: string, role: string, type: string) {
    await this.ensureAuthenticated();
    const permission: any = { type, role };
    if (emailAddress && type === 'user') permission.emailAddress = emailAddress;

    const response = await this.drive.permissions.create({
      fileId,
      resource: permission,
      fields: 'id,type,role,emailAddress',
    });

    return {
      id: response.data.id,
      type: response.data.type,
      role: response.data.role,
      emailAddress: response.data.emailAddress,
      message: 'Permission created successfully',
    };
  }

  async deleteDrivePermission(fileId: string, permissionId: string) {
    await this.ensureAuthenticated();
    await this.drive.permissions.delete({ fileId, permissionId });
    return { fileId, permissionId, message: 'Permission deleted successfully' };
  }

  // Revisions
  async listDriveRevisions(fileId: string) {
    await this.ensureAuthenticated();
    const response = await this.drive.revisions.list({
      fileId,
      fields: 'revisions(id,modifiedTime,size,keepForever,published,exportLinks)',
    });
    return {
      revisions: response.data.revisions?.map((revision: any) => ({
        id: revision.id,
        modifiedTime: revision.modifiedTime,
        size: revision.size,
        keepForever: revision.keepForever,
        published: revision.published,
        exportLinks: revision.exportLinks,
      })) || [],
    };
  }

  async getDriveRevision(fileId: string, revisionId: string) {
    await this.ensureAuthenticated();
    const response = await this.drive.revisions.get({
      fileId,
      revisionId,
      fields: 'id,modifiedTime,size,keepForever,published,exportLinks',
    });
    return {
      id: response.data.id,
      modifiedTime: response.data.modifiedTime,
      size: response.data.size,
      keepForever: response.data.keepForever,
      published: response.data.published,
      exportLinks: response.data.exportLinks,
    };
  }

  async deleteDriveRevision(fileId: string, revisionId: string) {
    await this.ensureAuthenticated();
    await this.drive.revisions.delete({ fileId, revisionId });
    return { fileId, revisionId, message: 'Revision deleted successfully' };
  }

  // Comments
  async listDriveComments(fileId: string, maxResults = 100) {
    await this.ensureAuthenticated();
    const response = await this.drive.comments.list({
      fileId,
      maxResults,
      fields: 'comments(id,content,createdTime,modifiedTime,author,quotedFileContent)',
    });
    return {
      comments: response.data.comments?.map((comment: any) => ({
        id: comment.id,
        content: comment.content,
        createdTime: comment.createdTime,
        modifiedTime: comment.modifiedTime,
        author: comment.author,
        quotedFileContent: comment.quotedFileContent,
      })) || [],
    };
  }

  async createDriveComment(fileId: string, content: string, quotedFileContent?: string) {
    await this.ensureAuthenticated();
    const comment: any = { content };
    if (quotedFileContent) comment.quotedFileContent = quotedFileContent;

    const response = await this.drive.comments.create({
      fileId,
      resource: comment,
      fields: 'id,content,createdTime,author',
    });

    return {
      id: response.data.id,
      content: response.data.content,
      createdTime: response.data.createdTime,
      author: response.data.author,
      message: 'Comment created successfully',
    };
  }

  async deleteDriveComment(fileId: string, commentId: string) {
    await this.ensureAuthenticated();
    await this.drive.comments.delete({ fileId, commentId });
    return { fileId, commentId, message: 'Comment deleted successfully' };
  }

  // Replies
  async listDriveReplies(fileId: string, commentId: string) {
    await this.ensureAuthenticated();
    const response = await this.drive.replies.list({
      fileId,
      commentId,
      fields: 'replies(id,content,createdTime,modifiedTime,author)',
    });
    return {
      replies: response.data.replies?.map((reply: any) => ({
        id: reply.id,
        content: reply.content,
        createdTime: reply.createdTime,
        modifiedTime: reply.modifiedTime,
        author: reply.author,
      })) || [],
    };
  }

  async createDriveReply(fileId: string, commentId: string, content: string) {
    await this.ensureAuthenticated();
    const response = await this.drive.replies.create({
      fileId,
      commentId,
      resource: { content },
      fields: 'id,content,createdTime,author',
    });

    return {
      id: response.data.id,
      content: response.data.content,
      createdTime: response.data.createdTime,
      author: response.data.author,
      message: 'Reply created successfully',
    };
  }

  async deleteDriveReply(fileId: string, commentId: string, replyId: string) {
    await this.ensureAuthenticated();
    await this.drive.replies.delete({ fileId, commentId, replyId });
    return { fileId, commentId, replyId, message: 'Reply deleted successfully' };
  }
}