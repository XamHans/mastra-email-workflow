import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';

// Updated path to use local credentials
const TOKEN_PATH = path.join(__dirname, 'credentials', 'calendar', 'token.json');

async function loadSavedCredentialsIfExist(): Promise<OAuth2Client | null> {
  try {
    const content = await fs.readFile(TOKEN_PATH, 'utf-8');
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials) as OAuth2Client;
  } catch (err) {
    return null;
  }
}

export const checkCalendarAvailabilityTool = createTool({
  id: 'check-calendar-availability',
  description: 'Checks calendar availability for scheduling meetings',
  inputSchema: z.object({
    startDate: z.string().describe('Start date in ISO format'),
    endDate: z.string().describe('End date in ISO format'),
    duration: z.number().describe('Meeting duration in minutes'),
  }),
  outputSchema: z.object({
    availableSlots: z.array(z.object({
      start: z.string(),
      end: z.string(),
    })),
    busySlots: z.array(z.object({
      start: z.string(),
      end: z.string(),
      title: z.string().optional(),
    })),
  }),
  execute: async ({ context }) => {
    // Mock implementation - no real API calls
    console.log(`📅 [MOCK] Checking calendar availability from ${context.startDate} to ${context.endDate}`);
    console.log(`📅 [MOCK] Looking for ${context.duration}-minute slots...`);
    
    // Return mock availability data
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const mockAvailableSlots = [
      {
        start: new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString(),
        end: new Date(tomorrow.setHours(11, 0, 0, 0)).toISOString(),
      },
      {
        start: new Date(tomorrow.setHours(14, 0, 0, 0)).toISOString(),
        end: new Date(tomorrow.setHours(15, 0, 0, 0)).toISOString(),
      },
    ];
    
    const mockBusySlots = [
      {
        start: new Date(tomorrow.setHours(9, 0, 0, 0)).toISOString(),
        end: new Date(tomorrow.setHours(9, 30, 0, 0)).toISOString(),
        title: 'Daily Standup',
      },
    ];
    
    console.log(`📅 [MOCK] Found ${mockAvailableSlots.length} available slots and ${mockBusySlots.length} busy slots`);
    
    return {
      availableSlots: mockAvailableSlots,
      busySlots: mockBusySlots,
    };
  },
});

export const createCalendarEventTool = createTool({
  id: 'create-calendar-event',
  description: 'Creates a calendar event for a meeting',
  inputSchema: z.object({
    title: z.string(),
    description: z.string().optional(),
    startTime: z.string().describe('Start time in ISO format'),
    endTime: z.string().describe('End time in ISO format'),
    attendees: z.array(z.string()).describe('Array of attendee email addresses'),
    location: z.string().optional(),
    sendNotifications: z.boolean().default(true),
  }),
  outputSchema: z.object({
    eventId: z.string(),
    eventUrl: z.string(),
    success: z.boolean(),
  }),
  execute: async ({ context }) => {
    // Mock implementation - no real API calls
    console.log(`📅 [MOCK] Creating calendar event:`);
    console.log(`   Title: ${context.title}`);
    console.log(`   Start: ${context.startTime}`);
    console.log(`   End: ${context.endTime}`);
    console.log(`   Attendees: ${context.attendees.join(', ')}`);
    if (context.description) {
      console.log(`   Description: ${context.description}`);
    }
    if (context.location) {
      console.log(`   Location: ${context.location}`);
    }
    console.log(`   Send Notifications: ${context.sendNotifications}`);
    console.log(`✅ [MOCK] Calendar event created successfully!`);
    
    const mockEventId = `mock-event-${Date.now()}`;
    
    return {
      eventId: mockEventId,
      eventUrl: `https://calendar.google.com/event?eid=${mockEventId}`,
      success: true,
    };
  },
});

export const suggestMeetingTimesTool = createTool({
  id: 'suggest-meeting-times',
  description: 'Suggests optimal meeting times based on calendar availability',
  inputSchema: z.object({
    duration: z.number().describe('Meeting duration in minutes'),
    daysAhead: z.number().default(7).describe('Number of days ahead to look'),
    preferredTimeStart: z.string().default('09:00').describe('Preferred start time (HH:MM)'),
    preferredTimeEnd: z.string().default('17:00').describe('Preferred end time (HH:MM)'),
    timezone: z.string().default('America/New_York'),
  }),
  outputSchema: z.object({
    suggestedTimes: z.array(z.object({
      start: z.string(),
      end: z.string(),
      dayOfWeek: z.string(),
      confidence: z.number().describe('Confidence score based on optimal timing'),
    })),
  }),
  execute: async ({ context }) => {
    // Mock implementation - no real API calls
    console.log(`📅 [MOCK] Suggesting meeting times:`);
    console.log(`   Duration: ${context.duration} minutes`);
    console.log(`   Looking ahead: ${context.daysAhead} days`);
    console.log(`   Preferred time: ${context.preferredTimeStart} - ${context.preferredTimeEnd}`);
    console.log(`   Timezone: ${context.timezone}`);
    
    // Generate mock suggestions
    const now = new Date();
    const mockSuggestions = [];
    
    for (let i = 1; i <= 3; i++) {
      const futureDate = new Date(now.getTime() + i * 24 * 60 * 60 * 1000);
      const startTime = new Date(futureDate.setHours(10 + i, 0, 0, 0));
      const endTime = new Date(startTime.getTime() + context.duration * 60 * 1000);
      
      mockSuggestions.push({
        start: startTime.toISOString(),
        end: endTime.toISOString(),
        dayOfWeek: startTime.toLocaleDateString('en-US', { weekday: 'long' }),
        confidence: 0.8 - (i * 0.1), // Higher confidence for earlier suggestions
      });
    }
    
    console.log(`📅 [MOCK] Generated ${mockSuggestions.length} meeting time suggestions`);
    
    return { suggestedTimes: mockSuggestions };
  },
});