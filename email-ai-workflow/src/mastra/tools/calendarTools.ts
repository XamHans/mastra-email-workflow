import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { promises as fs } from 'fs';
import path from 'path';

// Reuse auth logic from Gmail tools - in a real app, you'd extract this to a shared auth module
const TOKEN_PATH = path.join(process.cwd(), 'token.json');

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
    const auth = await loadSavedCredentialsIfExist();
    if (!auth) {
      throw new Error('No authentication credentials available');
    }

    const calendar = google.calendar({ version: 'v3', auth });

    // Get busy times
    const busyResponse = await calendar.freebusy.query({
      requestBody: {
        timeMin: context.startDate,
        timeMax: context.endDate,
        items: [{ id: 'primary' }],
      },
    });

    const busyTimes = busyResponse.data.calendars?.primary?.busy || [];
    const busySlots = busyTimes.map(busy => ({
      start: busy.start!,
      end: busy.end!,
      title: 'Busy',
    }));

    // Calculate available slots (simplified logic)
    const availableSlots = calculateAvailableSlots(
      new Date(context.startDate),
      new Date(context.endDate),
      busyTimes.map(busy => ({
        start: new Date(busy.start!),
        end: new Date(busy.end!),
      })),
      context.duration
    );

    return {
      availableSlots: availableSlots.map(slot => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })),
      busySlots,
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
    const auth = await loadSavedCredentialsIfExist();
    if (!auth) {
      throw new Error('No authentication credentials available');
    }

    const calendar = google.calendar({ version: 'v3', auth });

    const event = {
      summary: context.title,
      description: context.description,
      start: {
        dateTime: context.startTime,
        timeZone: 'America/New_York', // Could be made configurable
      },
      end: {
        dateTime: context.endTime,
        timeZone: 'America/New_York',
      },
      attendees: context.attendees.map(email => ({ email })),
      location: context.location,
      reminders: {
        useDefault: true,
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: context.sendNotifications ? 'all' : 'none',
    });

    return {
      eventId: response.data.id!,
      eventUrl: response.data.htmlLink!,
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
    const auth = await loadSavedCredentialsIfExist();
    if (!auth) {
      throw new Error('No authentication credentials available');
    }

    const now = new Date();
    const endDate = new Date(now.getTime() + context.daysAhead * 24 * 60 * 60 * 1000);

    // Check availability for the next week
    const availability = await checkCalendarAvailabilityTool.execute({
      context: {
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        duration: context.duration,
      },
    });

    // Filter available slots to preferred time range and score them
    const suggestedTimes = availability.availableSlots
      .map(slot => {
        const startTime = new Date(slot.start);
        const endTime = new Date(slot.end);
        const dayOfWeek = startTime.toLocaleDateString('en-US', { weekday: 'long' });
        
        // Calculate confidence based on time of day and day of week
        let confidence = 0.5;
        const hour = startTime.getHours();
        
        // Prefer mid-morning and early afternoon
        if (hour >= 10 && hour <= 11) confidence += 0.3;
        else if (hour >= 14 && hour <= 15) confidence += 0.2;
        else if (hour >= 9 && hour <= 16) confidence += 0.1;
        
        // Prefer Tuesday-Thursday
        const dayIndex = startTime.getDay();
        if (dayIndex >= 2 && dayIndex <= 4) confidence += 0.2;
        else if (dayIndex === 1 || dayIndex === 5) confidence += 0.1;
        
        return {
          start: slot.start,
          end: slot.end,
          dayOfWeek,
          confidence: Math.min(confidence, 1.0),
        };
      })
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5); // Return top 5 suggestions

    return { suggestedTimes };
  },
});

function calculateAvailableSlots(
  startDate: Date,
  endDate: Date,
  busySlots: Array<{ start: Date; end: Date }>,
  durationMinutes: number
): Array<{ start: Date; end: Date }> {
  const availableSlots: Array<{ start: Date; end: Date }> = [];
  const workingHours = { start: 9, end: 17 }; // 9 AM to 5 PM
  
  const currentDate = new Date(startDate);
  
  while (currentDate < endDate) {
    // Skip weekends
    if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }
    
    // Start at beginning of working day
    const dayStart = new Date(currentDate);
    dayStart.setHours(workingHours.start, 0, 0, 0);
    
    const dayEnd = new Date(currentDate);
    dayEnd.setHours(workingHours.end, 0, 0, 0);
    
    // Find gaps between busy slots
    const dayBusySlots = busySlots
      .filter(slot => 
        slot.start.toDateString() === currentDate.toDateString() ||
        slot.end.toDateString() === currentDate.toDateString()
      )
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    
    let currentSlotStart = dayStart;
    
    for (const busySlot of dayBusySlots) {
      if (busySlot.start > currentSlotStart) {
        const gapDuration = busySlot.start.getTime() - currentSlotStart.getTime();
        if (gapDuration >= durationMinutes * 60 * 1000) {
          availableSlots.push({
            start: new Date(currentSlotStart),
            end: new Date(currentSlotStart.getTime() + durationMinutes * 60 * 1000),
          });
        }
      }
      currentSlotStart = new Date(Math.max(currentSlotStart.getTime(), busySlot.end.getTime()));
    }
    
    // Check if there's time after the last busy slot
    if (currentSlotStart < dayEnd) {
      const remainingTime = dayEnd.getTime() - currentSlotStart.getTime();
      if (remainingTime >= durationMinutes * 60 * 1000) {
        availableSlots.push({
          start: new Date(currentSlotStart),
          end: new Date(currentSlotStart.getTime() + durationMinutes * 60 * 1000),
        });
      }
    }
    
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  return availableSlots;
}