# Google Drive MCP Server

A comprehensive Model Context Protocol (MCP) server for Google Drive and Google Docs integration.

## Features

- **Google Drive API Integration**: List, create, update, delete, copy, and move files
- **Google Docs API Integration**: Create, read, update, and manage Google Docs
- **File Management**: Handle permissions, comments, replies, and revisions
- **OAuth 2.0 Authentication**: Secure authentication with full Google account access
- **MCP Protocol**: Compatible with Model Context Protocol clients

## Supported Operations

### Google Docs
- Create documents
- Read document content
- Append text to documents
- Replace text in documents
- List documents
- Delete documents
- Export to PDF

### Google Drive
- List files and folders
- Get file metadata
- Create files
- Update files
- Delete files
- Copy files
- Move files
- Manage permissions
- Handle comments and replies
- Manage revisions

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/joseb33w/Google-MCP-Tools-Access.git
   cd Google-MCP-Tools-Access
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Google Cloud Console**
   - Create a new project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Google Drive API and Google Docs API
   - Create OAuth 2.0 credentials (Desktop application)
   - Download the credentials JSON file

4. **Run OAuth setup**
   ```bash
   node quick-oauth-setup.js
   ```
   - Follow the prompts to authenticate with Google
   - This will create a `.env` file with your credentials

5. **Start the server**
   ```bash
   npm start
   ```

## Deployment

This project includes Railway configuration for easy deployment:

1. **Deploy to Railway**
   - Connect your GitHub repository to Railway
   - Set environment variables in Railway dashboard
   - Deploy automatically

2. **Environment Variables**
   - `GOOGLE_CLIENT_ID`: Your OAuth client ID
   - `GOOGLE_CLIENT_SECRET`: Your OAuth client secret
   - `GOOGLE_REDIRECT_URI`: OAuth redirect URI
   - `GOOGLE_OAUTH_TOKENS`: OAuth tokens (JSON string)

## Usage

Once running, the MCP server provides tools for:
- Managing Google Drive files
- Working with Google Docs
- Handling file permissions and sharing
- Managing comments and collaboration features

## Security

- OAuth 2.0 authentication ensures secure access
- Environment variables keep credentials secure
- All sensitive files are excluded from version control

## License

ISC
