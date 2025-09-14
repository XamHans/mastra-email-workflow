# Scripts Directory

## Token Generation Script

### `generate-tokens.ts`

A unified script to generate OAuth tokens for Gmail and Google Calendar APIs.

#### Prerequisites

1. **Google Cloud Console Setup**:
   - Create a project in Google Cloud Console
   - Enable Gmail API and Calendar API
   - Create OAuth 2.0 credentials (Desktop application type)
   - Download the credentials JSON file

2. **Credentials Files**:
   - Place Gmail credentials at: `credentials/gmail/credentials.json`
   - Place Calendar credentials at: `credentials/calendar/credentials.json`

#### Usage

```bash
# Run the interactive token generator
npx tsx scripts/generate-tokens.ts
```

#### Features

- **Interactive Menu**: Choose which service to authenticate
- **Token Validation**: Checks if existing tokens are valid
- **Auto-Refresh**: Attempts to refresh expired tokens
- **API Testing**: Tests actual API connections
- **Error Handling**: Clear error messages and recovery

#### Menu Options

1. **Gmail only**: Authenticate Gmail API access
2. **Google Calendar only**: Authenticate Calendar API access
3. **Both Gmail and Calendar**: Authenticate both services
4. **Exit**: Quit the script

#### What It Does

1. **Checks Existing Tokens**: Validates current tokens if they exist
2. **Refreshes Tokens**: Attempts to refresh expired tokens automatically
3. **OAuth Flow**: Opens browser for new authentication if needed
4. **Saves Tokens**: Stores tokens in the correct credential directories
5. **Tests APIs**: Verifies that the tokens work with actual API calls

#### Required Scopes

- **Gmail API**:
  - `https://www.googleapis.com/auth/gmail.modify` (read, send, modify emails)

- **Calendar API**:
  - `https://www.googleapis.com/auth/calendar` (full calendar access)
  - `https://www.googleapis.com/auth/calendar.events` (calendar events access)

#### Output Files

After successful authentication:
- `credentials/gmail/token.json` - Gmail OAuth token
- `credentials/calendar/token.json` - Calendar OAuth token

#### Troubleshooting

- **"credentials.json not found"**: Make sure you have the OAuth credentials from Google Cloud Console
- **"Permission denied"**: Check that the APIs are enabled in Google Cloud Console
- **"Token refresh failed"**: Run the script again to re-authenticate
- **"Browser doesn't open"**: The script will display a URL you can copy manually

#### Security Notes

- Keep credentials files secure and never commit them to version control
- Tokens are stored locally and used only for your workflow
- Use the principle of least privilege with API scopes