import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Import tools
import { createCalendarEventTool } from '../tools/calendarTools.js';
import {
  archiveEmailTool,
  fetchUnreadEmailsTool,
  markEmailAsReadTool,
  sendEmailTool,
} from '../tools/gmailTools.js';

// Import agent functions
import { prepareHumanReviewTool } from '../agents/humanReviewAgent.js';
import { analyzeEmailIntentTool } from '../agents/intentAgent.js';
import { extractMeetingDetailsTool } from '../agents/meetingAgent.js';
import { generateEmailResponseTool } from '../agents/responseAgent.js';

// Step 1: Fetch Unread Emails
const fetchEmailsStep = createStep({
  id: 'fetch-emails',
  description: 'Fetch unread emails from Gmail',
  inputSchema: z.object({
    maxEmails: z.number().default(10).optional(),
  }),
  outputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        from: z.string(),
        body: z.string(),
        timestamp: z.date(),
        threadId: z.string().optional(),
      })
    ),
    totalCount: z.number(),
  }),
  execute: async ({ inputData }) => {
    try {
      return await fetchUnreadEmailsTool.execute({
        context: { maxResults: inputData.maxEmails },
      });
    } catch (error) {
      console.error('Error fetching emails:', error);
      // Return empty result on error to allow workflow to continue
      return { emails: [], totalCount: 0 };
    }
  },
  retries: 3,
});

// Step 2: Analyze Email Intent
const analyzeIntentStep = createStep({
  id: 'analyze-intent',
  description: 'Analyze email intent using reasoning model',
  inputSchema: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string().optional(),
      from: z.string(),
      body: z.string(),
      timestamp: z.date(),
      threadId: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string().optional(),
      from: z.string(),
      body: z.string(),
      timestamp: z.date(),
      threadId: z.string().optional(),
    }),
    intent: z.object({
      intent: z.enum(['reply', 'meeting', 'archive', 'human_review']),
      reasoning: z.string(),
      urgency: z.enum(['low', 'medium', 'high']),
      extractedInfo: z.object({
        keyTopics: z.array(z.string()),
        senderContext: z.string().optional(),
        actionRequired: z.boolean(),
      }),
    }),
  }),
  execute: async ({ inputData }) => {
    try {
      const intent = await analyzeEmailIntentTool({
        subject: inputData.email.subject || '',
        from: inputData.email.from,
        body: inputData.email.body,
      });

      return {
        email: inputData.email,
        intent,
      };
    } catch (error) {
      console.error('Error analyzing email intent:', error);
      // Default to human review on error
      return {
        email: inputData.email,
        intent: {
          intent: 'human_review' as const,
          confidence: 0.1,
          reasoning: `Error during intent analysis: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          urgency: 'medium' as const,
          extractedInfo: {
            keyTopics: [],
            actionRequired: true,
          },
        },
      };
    }
  },
  retries: 2,
});

// Branch Step 4a: Handle Reply Intent
const handleReplyStep = createStep({
  id: 'handle-reply',
  description: 'Generate and send email response',
  inputSchema: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string().optional(),
      from: z.string(),
      body: z.string(),
      timestamp: z.date(),
      threadId: z.string().optional(),
    }),
    intent: z.object({
      intent: z.enum(['reply', 'meeting', 'archive', 'human_review']),
      confidence: z.number(),
      reasoning: z.string(),
      urgency: z.enum(['low', 'medium', 'high']),
      extractedInfo: z.object({
        keyTopics: z.array(z.string()),
        senderContext: z.string().optional(),
        actionRequired: z.boolean(),
      }),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    action: z.string(),
    responseId: z.string().optional(),
  }),
  execute: async ({ inputData, mastra }) => {
    // Generate response using the email response agent
    const emailResponse = await generateEmailResponseTool({
      originalSubject: inputData.email.subject || '',
      originalFrom: inputData.email.from,
      originalBody: inputData.email.body,
      context: inputData.intent.extractedInfo.senderContext,
    });

    // Send the response
    const sendResult = await sendEmailTool.execute({
      context: {
        to: inputData.email.from,
        subject: emailResponse.subject,
        body: emailResponse.body,
        threadId: inputData.email.threadId,
        inReplyTo: inputData.email.id,
      },
    });

    // Mark original email as read
    await markEmailAsReadTool.execute({
      context: { messageId: inputData.email.id },
    });

    return {
      success: sendResult.success,
      action: 'reply_sent',
      responseId: sendResult.messageId,
    };
  },
});

// Branch Step 4b: Handle Meeting Intent
const handleMeetingStep = createStep({
  id: 'handle-meeting',
  description: 'Extract meeting details and create calendar event',
  inputSchema: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string().optional(),
      from: z.string(),
      body: z.string(),
      timestamp: z.date(),
      threadId: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    action: z.string(),
    eventId: z.string().optional(),
    responseId: z.string().optional(),
  }),
  execute: async ({ inputData }) => {
    // Extract meeting details using the meeting agent
    const meetingDetails = await extractMeetingDetailsTool({
      subject: inputData.email.subject || '',
      from: inputData.email.from,
      body: inputData.email.body,
    });

    // Create calendar event if we have sufficient details
    let eventResult = null;
    if (meetingDetails.suggestedTimes.length > 0) {
      const firstSuggestedTime = meetingDetails.suggestedTimes[0];
      eventResult = await createCalendarEventTool.execute({
        context: {
          title: meetingDetails.title,
          description: meetingDetails.description,
          startTime: firstSuggestedTime.start.toISOString(),
          endTime: firstSuggestedTime.end.toISOString(),
          attendees: meetingDetails.attendees,
          location: meetingDetails.location,
        },
      });
    }

    // Send confirmation response
    const responseBody = `Thank you for your meeting request. I've ${
      eventResult ? 'scheduled' : 'received your request for'
    } "${meetingDetails.title}".

${
  eventResult
    ? `Meeting Details:
- Date: ${meetingDetails.suggestedTimes[0]?.start}
- Duration: ${Math.round(
        (meetingDetails.suggestedTimes[0]?.end.getTime() -
          meetingDetails.suggestedTimes[0]?.start.getTime()) /
          60000
      )} minutes
- ${
        meetingDetails.isVirtual
          ? 'Virtual meeting'
          : `Location: ${meetingDetails.location}`
      }
- Attendees: ${meetingDetails.attendees.join(', ')}

Calendar invitation has been sent.`
    : 'I will review the details and get back to you with available times shortly.'
}`;

    const sendResult = await sendEmailTool.execute({
      context: {
        to: inputData.email.from,
        subject: `Re: ${inputData.email.subject}`,
        body: responseBody,
        threadId: inputData.email.threadId,
        inReplyTo: inputData.email.id,
      },
    });

    // Mark original email as read
    await markEmailAsReadTool.execute({
      context: { messageId: inputData.email.id },
    });

    return {
      success: true,
      action: 'meeting_scheduled',
      eventId: eventResult?.eventId,
      responseId: sendResult.messageId,
    };
  },
});

// Branch Step 4c: Handle Archive Intent
const handleArchiveStep = createStep({
  id: 'handle-archive',
  description: 'Archive email and mark as read',
  inputSchema: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string().optional(),
      from: z.string(),
      body: z.string(),
      timestamp: z.date(),
      threadId: z.string().optional(),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    action: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Archive the email
    await archiveEmailTool.execute({
      context: { messageId: inputData.email.id },
    });

    // Mark as read
    await markEmailAsReadTool.execute({
      context: { messageId: inputData.email.id },
    });

    return {
      success: true,
      action: 'archived',
    };
  },
});

// Branch Step 4d: Handle Human Review Intent
const handleHumanReviewStep = createStep({
  id: 'handle-human-review',
  description: 'Prepare email for human review',
  inputSchema: z.object({
    email: z.object({
      id: z.string(),
      subject: z.string().optional(),
      from: z.string(),
      body: z.string(),
      timestamp: z.date(),
      threadId: z.string().optional(),
    }),
    intent: z.object({
      reasoning: z.string(),
      urgency: z.enum(['low', 'medium', 'high']),
    }),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    action: z.string(),
    reviewSummary: z.string(),
  }),
  execute: async ({ inputData }) => {
    // Prepare for human review
    const reviewData = await prepareHumanReviewTool({
      subject: inputData.email.subject || '',
      from: inputData.email.from,
      body: inputData.email.body,
      reason: inputData.intent.reasoning,
      urgency: inputData.intent.urgency,
    });

    // In a real implementation, this would trigger a notification system
    console.log(`📧 Email requires human review:`, {
      emailId: inputData.email.id,
      from: inputData.email.from,
      subject: inputData.email.subject,
      urgency: inputData.intent.urgency,
      summary: reviewData.summary,
    });

    return {
      success: true,
      action: 'queued_for_human_review',
      reviewSummary: reviewData.summary,
    };
  },
});

// Main Email Processing Workflow
export const emailProcessingWorkflow = createWorkflow({
  id: 'email-processing-workflow',
  description: 'Processes unread emails with intelligent intent-based routing',
  inputSchema: z.object({
    maxEmails: z.number().default(10).optional(),
  }),
  outputSchema: z.object({
    processedCount: z.number(),
    results: z.array(
      z.object({
        emailId: z.string(),
        action: z.string(),
        success: z.boolean(),
        error: z.string().optional(),
      })
    ),
  }),
  retryConfig: {
    attempts: 3,
    delay: 2000,
  },
})
  .then(fetchEmailsStep)
  .foreach(
    createWorkflow({
      id: 'process-single-email',
      description: 'Process a single email through the intent-based pipeline',
      inputSchema: z.object({
        id: z.string(),
        subject: z.string().optional(),
        from: z.string(),
        body: z.string(),
        timestamp: z.date(),
        threadId: z.string().optional(),
      }),
      outputSchema: z.object({
        emailId: z.string(),
        action: z.string(),
        success: z.boolean(),
      }),
    })
      .map(({ inputData }) => ({ email: inputData }))
      .then(analyzeIntentStep)
      .branch([
        // Reply branch
        [
          async ({ inputData }) => inputData.intent.intent === 'reply',
          createWorkflow({
            id: 'handle-reply-workflow',
            description: 'Handle reply intent',
            inputSchema: z.object({
              email: z.object({
                id: z.string(),
                subject: z.string().optional(),
                from: z.string(),
                body: z.string(),
                timestamp: z.date(),
                threadId: z.string().optional(),
              }),
              intent: z.object({
                intent: z.enum(['reply', 'meeting', 'archive', 'human_review']),
                confidence: z.number(),
                reasoning: z.string(),
                urgency: z.enum(['low', 'medium', 'high']),
                extractedInfo: z.object({
                  keyTopics: z.array(z.string()),
                  senderContext: z.string().optional(),
                  actionRequired: z.boolean(),
                }),
              }),
            }),
            outputSchema: z.object({
              success: z.boolean(),
              action: z.string(),
              responseId: z.string().optional(),
            }),
          })
            .map(({ inputData }) => ({
              email: inputData.email,
              intent: inputData.intent,
            }))
            .then(handleReplyStep)
            .commit(),
        ],
        // Meeting branch
        [
          async ({ inputData }) => inputData.intent.intent === 'meeting',
          createWorkflow({
            id: 'handle-meeting-workflow',
            description: 'Handle meeting intent',
            inputSchema: z.object({
              email: z.object({
                id: z.string(),
                subject: z.string().optional(),
                from: z.string(),
                body: z.string(),
                timestamp: z.date(),
                threadId: z.string().optional(),
              }),
              intent: z.object({
                intent: z.enum(['reply', 'meeting', 'archive', 'human_review']),
                confidence: z.number(),
                reasoning: z.string(),
                urgency: z.enum(['low', 'medium', 'high']),
                extractedInfo: z.object({
                  keyTopics: z.array(z.string()),
                  senderContext: z.string().optional(),
                  actionRequired: z.boolean(),
                }),
              }),
            }),
            outputSchema: z.object({
              success: z.boolean(),
              action: z.string(),
              eventId: z.string().optional(),
              responseId: z.string().optional(),
            }),
          })
            .map(({ inputData }) => ({
              email: inputData.email,
            }))
            .then(handleMeetingStep)
            .commit(),
        ],
        // Archive branch
        [
          async ({ inputData }) => inputData.intent.intent === 'archive',
          createWorkflow({
            id: 'handle-archive-workflow',
            description: 'Handle archive intent',
            inputSchema: z.object({
              email: z.object({
                id: z.string(),
                subject: z.string().optional(),
                from: z.string(),
                body: z.string(),
                timestamp: z.date(),
                threadId: z.string().optional(),
              }),
              intent: z.object({
                intent: z.enum(['reply', 'meeting', 'archive', 'human_review']),
                confidence: z.number(),
                reasoning: z.string(),
                urgency: z.enum(['low', 'medium', 'high']),
                extractedInfo: z.object({
                  keyTopics: z.array(z.string()),
                  senderContext: z.string().optional(),
                  actionRequired: z.boolean(),
                }),
              }),
            }),
            outputSchema: z.object({
              success: z.boolean(),
              action: z.string(),
            }),
          })
            .map(({ inputData }) => ({
              email: inputData.email,
            }))
            .then(handleArchiveStep)
            .commit(),
        ],
        // Human review branch
        [
          async ({ inputData }) => inputData.intent.intent === 'human_review',
          createWorkflow({
            id: 'handle-human-review-workflow',
            description: 'Handle human review intent',
            inputSchema: z.object({
              email: z.object({
                id: z.string(),
                subject: z.string().optional(),
                from: z.string(),
                body: z.string(),
                timestamp: z.date(),
                threadId: z.string().optional(),
              }),
              intent: z.object({
                reasoning: z.string(),
                urgency: z.enum(['low', 'medium', 'high']),
              }),
            }),
            outputSchema: z.object({
              success: z.boolean(),
              action: z.string(),
              reviewSummary: z.string(),
            }),
          })
            .map(({ inputData }) => ({
              email: inputData.email,
              intent: {
                reasoning: inputData.intent.reasoning,
                urgency: inputData.intent.urgency,
              },
            }))
            .then(handleHumanReviewStep)
            .commit(),
        ],
      ])
      .map(({ inputData, getStepResult }) => {
        // Try to get the result from any of the branch workflows
        const result =
          getStepResult('handle-reply-workflow') ||
          getStepResult('handle-meeting-workflow') ||
          getStepResult('handle-archive-workflow') ||
          getStepResult('handle-human-review-workflow');

        return {
          emailId: inputData.email.id,
          action: result?.action || 'unknown',
          success: result?.success || false,
        };
      })
      .commit()
  )
  .map(({ inputData, getStepResult }) => {
    const fetchResult = getStepResult(fetchEmailsStep);
    const processResults = getStepResult('process-single-email') || [];

    return {
      processedCount: Array.isArray(processResults) ? processResults.length : 0,
      results: Array.isArray(processResults) ? processResults : [],
    };
  });

emailProcessingWorkflow.commit();
