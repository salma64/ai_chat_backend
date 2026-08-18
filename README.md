# AI Chat Backend

A standalone backend for an AI chat application built with **Node.js**, **Express**, **Google Gemini API**, and **MongoDB**.

The backend supports real-time streamed AI responses, persistent chat history, multiple conversations, response regeneration, and user feedback.

## Features

- Gemini API integration
- Express REST API
- SSE streaming responses
- MongoDB chat persistence
- Multiple conversation support
- Resume previous conversations
- Response regeneration
- Like / dislike feedback
- 429 rate-limit handling
- 503 service-unavailable handling
- Automatic development restart with Nodemon

## Technologies

- Node.js
- Express
- MongoDB
- Mongoose
- Google Gemini API
- Server-Sent Events (SSE)
- Nodemon

## Requirements

Before running the backend, make sure you have:

- Node.js installed
- MongoDB Community Server installed
- MongoDB running as a Windows Service
- A Gemini API key

## Installation

Install the project dependencies:

```bash
npm install
```

## Environment Variables

Create a `.env` file in the backend root directory:

```text
ai_chat_backend/
├── models/
├── .env
├── package.json
├── server.js
└── README.md
```

Add your Gemini API key:

```env
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

Do not commit the `.env` file or expose your API key publicly.

## MongoDB

The application connects to the local MongoDB server using:

```text
mongodb://127.0.0.1:27017/ai_chat
```

MongoDB should be running as a Windows Service with the startup type set to Automatic.

The application stores chat data in:

```text
Database: ai_chat
Collection: chats
```

Each chat record contains:

- Conversation ID
- User message
- Assistant response
- Feedback
- Creation date

## Run the Backend

For development:

```bash
npm run dev
```

For normal execution:

```bash
npm start
```

The API will run at:

```text
http://localhost:3000
```

## API Endpoints

### Send Message

```http
POST /api/chat
```

Sends a user message to Gemini and streams the response using SSE.

Example request body:

```json
{
  "message": "Hello",
  "conversationId": "conversation-id",
  "regenerate": false
}
```

### Load Chat History

```http
GET /api/history/:conversationId
```

Returns the saved history for a specific conversation.

### Get Conversations

```http
GET /api/conversations
```

Returns the available conversation threads.

### Save Feedback

```http
POST /api/feedback
```

Example request:

```json
{
  "conversationId": "conversation-id",
  "userMessage": "Hello",
  "feedback": "like"
}
```

Supported feedback values:

```text
like
dislike
```

## Error Handling

The backend handles common Gemini API errors, including:

- `429` — Rate Limit Exceeded
- `503` — Gemini temporarily unavailable

Temporary Gemini availability errors are retried before returning an error to the frontend.

## Frontend Integration

The frontend communicates with this backend through:

```text
http://localhost:3000
```

The frontend supports:

- Streaming Gemini responses
- Chat history
- New conversations
- Previous conversation selection
- Response regeneration
- Like / dislike feedback

## Project Structure

```text
ai_chat_backend/
├── models/
│   └── Chat.js
├── .env
├── package.json
├── package-lock.json
├── server.js
├── testGemini.js
└── README.md
```

## Security

Never commit the `.env` file containing the Gemini API key.

Add the following to `.gitignore`:

```gitignore
node_modules/
.env
```