const mongoose = require("mongoose");

const citationSchema = new mongoose.Schema(
  {
    id: {
      type: Number,
      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    snippet: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  }
);

const citationSupportSchema = new mongoose.Schema(
  {
    startIndex: {
      type: Number,
      default: 0,
    },

    endIndex: {
      type: Number,
      default: 0,
    },

    text: {
      type: String,
      default: "",
    },

    sourceIds: {
      type: [Number],
      default: [],
    },
  },
  {
    _id: false,
  }
);

const versionSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },

    citations: {
      type: [citationSchema],
      default: [],
    },

    citationSupports: {
      type: [citationSupportSchema],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const chatSchema = new mongoose.Schema({
  conversationId: {
    type: String,
    required: true,
  },

  userMessage: {
    type: String,
    required: true,
  },

  assistantMessage: {
    type: String,
    required: true,
  },

  versions: {
    type: [versionSchema],
    default: [],
  },

  currentVersion: {
    type: Number,
    default: 0,
  },

  citations: {
    type: [citationSchema],
    default: [],
  },

  citationSupports: {
    type: [citationSupportSchema],
    default: [],
  },

  feedback: {
    type: String,
    enum: ["like", "dislike", null],
    default: null,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model(
  "Chat",
  chatSchema
);