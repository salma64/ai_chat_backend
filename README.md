# AI Chat Backend

Node.js backend for a full-stack AI chat application powered by the Gemini API, MongoDB, and Server-Sent Events (SSE).

## Features

- Gemini LLM integration
- Server-Sent Events (SSE) streaming
- MongoDB conversation persistence
- Conversation history and thread resume
- Response regeneration
- Multiple response versions
- Google Search grounding and citations
- Citation persistence
- Like/dislike feedback storage
- Custom AI system instructions
- Error handling for API rate limits and temporary failures

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Mongoose
- Google GenAI SDK
- Gemini API
- Server-Sent Events (SSE)

## Project Structure

```text
ai_chat_backend/
├── models/
│   └── Chat.js
├── AI_INSTRUCTIONS.md
├── server.js
├── testGemini.js
├── package.json
├── package-lock.json
├── .gitignore
└── README.md
```

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do not commit the `.env` file.

### 3. Start MongoDB

Make sure MongoDB is running locally on:

```text
mongodb://127.0.0.1:27017/ai_chat
```

### 4. Start the backend

```bash
node server.js
```

The API will run on:

```text
http://localhost:3000
```

## API Endpoints

### POST `/api/chat`

Streams an AI response using SSE and saves the conversation to MongoDB.

Example request:

```json
{
  "message": "Explain REST APIs",
  "conversationId": "example-conversation-id",
  "regenerate": false
}
```

### GET `/api/history/:conversationId`

Loads all messages belonging to a conversation.

### GET `/api/conversations`

Returns the saved conversation thread list.

### POST `/api/feedback`

Stores like/dislike feedback for an AI response.

Example:

```json
{
  "conversationId": "example-conversation-id",
  "userMessage": "Explain REST APIs",
  "feedback": "like"
}
```

## AI Customization

`AI_INSTRUCTIONS.md` contains the custom system instructions used by the Gemini model.

The backend loads these instructions when the server starts and passes them to Gemini as the system instruction.

## Streaming

The backend uses Server-Sent Events (SSE) to progressively send generated text to the React frontend.

The stream ends with:

```text
data: [DONE]
```

## Database

MongoDB stores:

- Conversation ID
- User message
- Assistant response
- Response versions
- Citations
- Citation supports
- Feedback
- Creation timestamps

## Security

Secrets such as the Gemini API key are stored in `.env`.

The `.env` file and `node_modules` are excluded from Git using `.gitignore`.