import { z } from 'zod';

export const EmailMessageSchema = z.object({
  id: z.string(),
  subject: z.string().optional(),
  from: z.string(),
  body: z.string(),
  timestamp: z.date(),
  threadId: z.string().optional(),
});

export const EmailIntentSchema = z.object({
  intent: z.enum(['reply', 'meeting', 'archive', 'human_review']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  urgency: z.enum(['low', 'medium', 'high']),
  extractedInfo: z.object({
    keyTopics: z.array(z.string()),
    senderContext: z.string().optional(),
    actionRequired: z.boolean(),
  }),
});

export const MeetingDetailsSchema = z.object({
  title: z.string(),
  description: z.string(),
  suggestedTimes: z.array(z.object({
    start: z.date(),
    end: z.date(),
    timezone: z.string(),
  })),
  attendees: z.array(z.string()),
  location: z.string().optional(),
  isVirtual: z.boolean(),
});

export const EmailResponseSchema = z.object({
  subject: z.string(),
  body: z.string(),
  tone: z.enum(['professional', 'friendly', 'formal', 'casual']),
  includedAttachments: z.array(z.string()).optional(),
});

export type EmailMessage = z.infer<typeof EmailMessageSchema>;
export type EmailIntent = z.infer<typeof EmailIntentSchema>;
export type MeetingDetails = z.infer<typeof MeetingDetailsSchema>;
export type EmailResponse = z.infer<typeof EmailResponseSchema>;