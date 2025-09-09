# Email AI Workflow

An AI-powered email management system using Mastra framework and Gmail API.

## Gmail API Setup

### 1. Get Gmail API Credentials

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Create/Select Project**: Create a new project or select an existing one
3. **Enable Gmail API**: 
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API" and enable it
4. **Create Credentials**:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop application"
   - Download the JSON file
5. **Save as credentials.json**: Place the downloaded file in your project root as `credentials.json`

### 2. Credentials File Format

The `credentials.json` should look like:
```json
{
  "installed": {
    "client_id": "your-client-id",
    "project_id": "your-project",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "client_secret": "your-client-secret",
    "redirect_uris": ["http://localhost"]
  }
}
```

### 3. Token Management

The application automatically handles OAuth tokens:

- **First run**: No `token.json` → Opens browser for OAuth consent → Saves token
- **Subsequent runs**: Reads existing `token.json` → No browser needed  
- **Token expired**: Google library automatically refreshes it

The `token.json` file will be automatically created in your project root after the first successful authentication.

## Available Tools

- **fetchUnreadEmailsTool**: Fetches unread emails from the last 2 days
- **sendEmailTool**: Sends email responses 
- **markEmailAsReadTool**: Marks emails as read
- **archiveEmailTool**: Archives emails by removing from inbox