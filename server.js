require("dotenv").config();

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

const Chat = require("./models/Chat");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

const sleep = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

mongoose
  .connect("mongodb://127.0.0.1:27017/ai_chat")
  .then(() => {
    console.log("MongoDB connected");
  })
  .catch((error) => {
    console.error(
      "MongoDB connection error:",
      error.message
    );
  });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

/*
 * Custom AI Instructions
 * تعليمات الذكاء الاصطناعي المخصصة
 */
const instructionsPath = path.join(
  __dirname,
  "AI_INSTRUCTIONS.md"
);

const systemInstruction = fs.readFileSync(
  instructionsPath,
  "utf8"
);

console.log("AI instructions loaded");

app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      conversationId,
      regenerate = false,
    } = req.body;

    if (!message) {
      return res.status(400).json({
        error: "Message is required",
      });
    }

    /*
     * SSE Headers
     * إعدادات البث التدريجي
     */
    res.setHeader(
      "Content-Type",
      "text/event-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    let stream;

    /*
     * Try Gemini up to 3 times
     * إعادة المحاولة لو Gemini مشغول
     */
    for (
      let attempt = 1;
      attempt <= 3;
      attempt++
    ) {
      try {
        stream =
          await ai.models.generateContentStream({
            model: "gemini-3.5-flash",

            contents: message,

            config: {
              /*
               * Custom AI Instructions
               */
              systemInstruction,

              /*
               * Google Search Grounding
               * البحث والمراجع
               */
              tools: [
                {
                  googleSearch: {},
                },
              ],
            },
          });

        break;
      } catch (error) {
        if (
          error.status === 503 &&
          attempt < 3
        ) {
          console.log(
            `Gemini busy. Retry ${attempt}/3...`
          );

          await sleep(
            1500 * attempt
          );
        } else {
          throw error;
        }
      }
    }

    let fullResponse = "";

    /*
     * Grounding information
     * بيانات المصادر
     */
    const groundingChunks = [];
    const groundingSupports = [];
    const webSearchQueries = [];

    /*
     * Receive Gemini stream
     * استقبال الرد التدريجي
     */
    for await (const chunk of stream) {
      const text = chunk.text;

      const groundingMetadata =
        chunk.candidates?.[0]
          ?.groundingMetadata;

      if (groundingMetadata) {
        if (
          Array.isArray(
            groundingMetadata.groundingChunks
          )
        ) {
          groundingChunks.push(
            ...groundingMetadata.groundingChunks
          );
        }

        if (
          Array.isArray(
            groundingMetadata.groundingSupports
          )
        ) {
          groundingSupports.push(
            ...groundingMetadata.groundingSupports
          );
        }

        if (
          Array.isArray(
            groundingMetadata.webSearchQueries
          )
        ) {
          webSearchQueries.push(
            ...groundingMetadata.webSearchQueries
          );
        }
      }

      if (text) {
        fullResponse += text;

        /*
         * Keep our word-by-word streaming
         * الحفاظ على البث كلمة بكلمة
         */
        const words =
          text.split(/(\s+)/);

        for (const word of words) {
          if (word) {
            res.write(
              `data: ${JSON.stringify({
                text: word,
              })}\n\n`
            );

            await sleep(30);
          }
        }
      }
    }

    /*
     * Build citations
     * تجهيز قائمة المصادر
     */
    const citations = [];

    groundingChunks.forEach(
      (chunk, index) => {
        const web = chunk?.web;

        if (
          web?.uri &&
          !citations.some(
            (citation) =>
              citation.url === web.uri
          )
        ) {
          citations.push({
            id:
              citations.length + 1,

            title:
              web.title ||
              `Source ${index + 1}`,

            url:
              web.uri,

            snippet: "",
          });
        }
      }
    );

    /*
     * Connect answer sections
     * to their citations
     * ربط أجزاء الرد بالمصادر
     */
    const citationSupports =
      groundingSupports
        .map((support) => {
          const segment =
            support.segment;

          if (!segment) {
            return null;
          }

          const sourceIds =
            (
              support.groundingChunkIndices ||
              []
            )
              .map(
                (chunkIndex) => {
                  const chunk =
                    groundingChunks[
                      chunkIndex
                    ];

                  const url =
                    chunk?.web?.uri;

                  if (!url) {
                    return null;
                  }

                  const citation =
                    citations.find(
                      (item) =>
                        item.url ===
                        url
                    );

                  return citation?.id;
                }
              )
              .filter(Boolean);

          if (
            sourceIds.length === 0
          ) {
            return null;
          }

          return {
            startIndex:
              segment.startIndex ?? 0,

            endIndex:
              segment.endIndex ?? 0,

            text:
              segment.text || "",

            sourceIds,
          };
        })
        .filter(Boolean);

    /*
     * Send citation information
     * to React
     * إرسال المصادر للواجهة
     */
    res.write(
      `data: ${JSON.stringify({
        type: "citations",

        citations,

        citationSupports,

        webSearchQueries: [
          ...new Set(
            webSearchQueries
          ),
        ],
      })}\n\n`
    );

    /*
     * Save in MongoDB
     * حفظ المحادثة
     */
    if (
      mongoose.connection.readyState === 1
    ) {
      const activeConversationId =
        conversationId || "default";

      /*
       * Regenerate
       * إنشاء نسخة جديدة
       */
      if (regenerate) {
        const chat =
          await Chat.findOne({
            conversationId:
              activeConversationId,

            userMessage:
              message,
          }).sort({
            createdAt: -1,
          });

        if (chat) {
          /*
           * Support old database records
           * دعم الرسائل القديمة
           */
          if (
            !Array.isArray(
              chat.versions
            ) ||
            chat.versions.length === 0
          ) {
            chat.versions = [
              {
                content:
                  chat.assistantMessage,

                citations:
                  chat.citations || [],

                citationSupports:
                  chat.citationSupports ||
                  [],
              },
            ];
          }

          /*
           * Add new response version
           * إضافة نسخة الرد الجديدة
           */
          chat.versions.push({
            content:
              fullResponse,

            citations,

            citationSupports,
          });

          chat.currentVersion =
            chat.versions.length - 1;

          /*
           * Keep latest response here
           * for backward compatibility
           */
          chat.assistantMessage =
            fullResponse;

          chat.citations =
            citations;

          chat.citationSupports =
            citationSupports;

          chat.feedback = null;

          await chat.save();

          console.log(
            `New response version saved. Total versions: ${chat.versions.length}`
          );
        } else {
          /*
           * If regenerate was requested
           * but no old message exists
           */
          await Chat.create({
            conversationId:
              activeConversationId,

            userMessage:
              message,

            assistantMessage:
              fullResponse,

            versions: [
              {
                content:
                  fullResponse,

                citations,

                citationSupports,
              },
            ],

            currentVersion: 0,

            citations,

            citationSupports,

            feedback: null,
          });

          console.log(
            "No previous chat found, created first version"
          );
        }
      } else {
        /*
         * Normal new message
         * رسالة جديدة عادية
         */
        await Chat.create({
          conversationId:
            activeConversationId,

          userMessage:
            message,

          assistantMessage:
            fullResponse,

          versions: [
            {
              content:
                fullResponse,

              citations,

              citationSupports,
            },
          ],

          currentVersion: 0,

          citations,

          citationSupports,

          feedback: null,
        });

        console.log(
          "Chat saved to MongoDB"
        );
      }
    }

    /*
     * End SSE stream
     */
    res.write(
      "data: [DONE]\n\n"
    );

    res.end();
  } catch (error) {
    console.error(
      "Chat error:",
      error
    );

    let errorMessage =
      "Something went wrong";

    if (error.status === 429) {
      errorMessage =
        "Rate limit reached. Please try again shortly.";
    }

    if (error.status === 503) {
      errorMessage =
        "Gemini is temporarily busy. Please try again shortly.";
    }

    /*
     * If SSE has not started yet
     */
    if (!res.headersSent) {
      return res
        .status(
          error.status || 500
        )
        .json({
          error:
            errorMessage,
        });
    }

    /*
     * If SSE already started
     */
    res.write(
      `data: ${JSON.stringify({
        error:
          errorMessage,
      })}\n\n`
    );

    res.write(
      "data: [DONE]\n\n"
    );

    res.end();
  }
});

/*
 * Load conversation history
 * تحميل محادثة قديمة
 */
app.get(
  "/api/history/:conversationId",
  async (req, res) => {
    try {
      const chats =
        await Chat.find({
          conversationId:
            req.params.conversationId,
        }).sort({
          createdAt: 1,
        });

      res.json(chats);
    } catch (error) {
      console.error(
        "History error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load chat history",
      });
    }
  }
);

/*
 * Conversation thread list
 * قائمة المحادثات
 */
app.get(
  "/api/conversations",
  async (req, res) => {
    try {
      const conversations =
        await Chat.aggregate([
          {
            $sort: {
              createdAt: -1,
            },
          },

          {
            $group: {
              _id:
                "$conversationId",

              lastMessage: {
                $first:
                  "$userMessage",
              },

              updatedAt: {
                $first:
                  "$createdAt",
              },
            },
          },

          {
            $sort: {
              updatedAt: -1,
            },
          },
        ]);

      res.json(
        conversations.map(
          (conversation) => ({
            conversationId:
              conversation._id,

            title:
              conversation.lastMessage,

            updatedAt:
              conversation.updatedAt,
          })
        )
      );
    } catch (error) {
      console.error(
        "Conversations error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load conversations",
      });
    }
  }
);

/*
 * Feedback endpoint
 * حفظ الإعجاب أو عدم الإعجاب
 */
app.post(
  "/api/feedback",
  async (req, res) => {
    try {
      const {
        conversationId,
        userMessage,
        feedback,
      } = req.body;

      if (
        !conversationId ||
        !userMessage ||
        !feedback
      ) {
        return res.status(400).json({
          error:
            "conversationId, userMessage and feedback are required",
        });
      }

      if (
        ![
          "like",
          "dislike",
        ].includes(feedback)
      ) {
        return res.status(400).json({
          error:
            "Feedback must be like or dislike",
        });
      }

      const updatedChat =
        await Chat.findOneAndUpdate(
          {
            conversationId,
            userMessage,
          },

          {
            $set: {
              feedback,
            },
          },

          {
            sort: {
              createdAt: -1,
            },

            returnDocument:
              "after",
          }
        );

      if (!updatedChat) {
        return res.status(404).json({
          error:
            "Chat not found",
        });
      }

      console.log(
        `Feedback saved: ${feedback}`
      );

      res.json({
        success: true,

        feedback:
          updatedChat.feedback,
      });
    } catch (error) {
      console.error(
        "Feedback error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to save feedback",
      });
    }
  }
);

/*
 * Start server
 */
app.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});