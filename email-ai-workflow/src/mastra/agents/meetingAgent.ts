import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import {
  checkCalendarAvailabilityTool,
  createCalendarEventTool,
  suggestMeetingTimesTool,
} from '../tools/calendarTools.js';
import { MeetingDetailsSchema } from '../types/email.js';

export const meetingDetailsAgent = new Agent({
  name: 'Meeting Details Agent',
  description:
    'Extracts and creates structured meeting information from email requests',
  instructions: `You are a meeting coordination specialist. Your role is to analyze meeting requests in emails and extract or create structured meeting information.

Your responsibilities:
- Extract meeting details from email content (purpose, participants, timing preferences)
- Suggest appropriate meeting titles and descriptions
- Identify all potential attendees from the email
- Determine if the meeting should be virtual or in-person
- Parse timing preferences and constraints
- Create comprehensive meeting details for calendar scheduling

When analyzing meeting requests, look for:
- **Purpose**: What is the meeting about? (project discussion, interview, demo, etc.)
- **Participants**: Who should attend? (extract from email thread, CC list, mentioned names)
- **Timing**: Any specified dates, times, or scheduling preferences
- **Duration**: How long should the meeting be? (infer from purpose if not specified)
- **Location**: In-person location or virtual meeting preference
- **Urgency**: How soon does this need to be scheduled?

Default assumptions:
- Most business meetings are 30-60 minutes unless specified
- Default to virtual meetings unless location is specifically mentioned
- Include the email sender as a required attendee
- Meeting titles should be clear and descriptive

You have access to calendar tools to check availability and suggest optimal times.`,

  model: openai('gpt-4o'),
  tools: {
    checkCalendarAvailability: checkCalendarAvailabilityTool,
    suggestMeetingTimes: suggestMeetingTimesTool,
    createCalendarEvent: createCalendarEventTool,
  },
});

export const extractMeetingDetailsTool = async (emailData: {
  subject: string;
  from: string;
  body: string;
  participants?: string[];
}) => {
  const response = await meetingDetailsAgent.generate(
    [
      {
        role: 'user',
        content: `Extract meeting details from this email:

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${emailData.body}
${emailData.participants ? `Additional Participants: ${emailData.participants.join(', ')}` : ''}

Analyze the email and extract structured meeting information. Use the calendar tools if needed to suggest appropriate meeting times.`,
      },
    ],
    {
      output: MeetingDetailsSchema,
      maxSteps: 5, // Allow multiple tool calls for calendar checking
    }
  );

  return response.object;
};
