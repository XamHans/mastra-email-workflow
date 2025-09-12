import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Import tools
import { fetchUnreadEmailsTool, markEmailAsReadTool, archiveEmailTool } from '../tools/gmailTools.js';

// Import simple intent agent
import { analyzeEmailIntentTool } from '../agents/intentAgent.js';

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
      })
    ),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    try {
      const result = await fetchUnreadEmailsTool.execute({
        context: { maxResults: inputData.maxEmails },
        runtimeContext,
        tracingContext: {},
      });
      
      // Simplify email objects
      const emails = result.emails.map(email => ({
        id: email.id,
        subject: email.subject,
        from: email.from,
        body: email.body,
      }));
      
      return { emails };
    } catch (error) {
      console.error('Error fetching emails:', error);
      return { emails: [] };
    }
  },
});

// Step 2: Analyze Intent and Route
const analyzeAndRouteStep = createStep({
  id: 'analyze-and-route',
  description: 'Analyze email intent and route to appropriate action',
  inputSchema: z.object({
    emails: z.array(
      z.object({
        id: z.string(),
        subject: z.string().optional(),
        from: z.string(),
        body: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        emailId: z.string(),
        intent: z.string(),
        action: z.string(),
      })
    ),
  }),
  execute: async ({ inputData, runtimeContext }) => {
    const results = [];
    
    for (const email of inputData.emails) {
      try {
        // Get intent
        const intentResult = await analyzeEmailIntentTool({
          subject: email.subject || '',
          from: email.from,
          body: email.body,
        });
        
        // Route based on intent with simple console logs
        let action = '';
        switch (intentResult.intent) {
          case 'reply':
            console.log(`📧 Reply needed for email from ${email.from}: "${email.subject}"`);
            console.log(`   Reasoning: ${intentResult.reasoning}`);
            console.log(`   Action: Simple acknowledgment sent`);
            action = 'reply_acknowledged';
            break;
            
          case 'meeting':
            console.log(`📅 Meeting request from ${email.from}: "${email.subject}"`);
            console.log(`   Reasoning: ${intentResult.reasoning}`);
            console.log(`   Action: Meeting request noted`);
            action = 'meeting_noted';
            break;
            
          case 'archive':
            console.log(`📁 Archiving email from ${email.from}: "${email.subject}"`);
            console.log(`   Reasoning: ${intentResult.reasoning}`);
            await archiveEmailTool.execute({ 
              context: { messageId: email.id },
              runtimeContext,
              tracingContext: {},
            });
            action = 'archived';
            break;
            
          case 'human_review':
            console.log(`👤 Human review needed for email from ${email.from}: "${email.subject}"`);
            console.log(`   Reasoning: ${intentResult.reasoning}`);
            console.log(`   Action: Flagged for human review`);
            action = 'human_review_flagged';
            break;
            
          default:
            console.log(`❓ Unknown intent for email from ${email.from}`);
            action = 'unknown';
        }
        
        // Mark email as read
        await markEmailAsReadTool.execute({ 
          context: { messageId: email.id },
          runtimeContext,
          tracingContext: {},
        });
        
        results.push({
          emailId: email.id,
          intent: intentResult.intent,
          action: action,
        });
        
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        results.push({
          emailId: email.id,
          intent: 'error',
          action: 'failed',
        });
      }
    }
    
    return { results };
  },
});

// Step 3: Summary
const summaryStep = createStep({
  id: 'summary',
  description: 'Log processing summary',
  inputSchema: z.object({
    results: z.array(
      z.object({
        emailId: z.string(),
        intent: z.string(),
        action: z.string(),
      })
    ),
  }),
  outputSchema: z.object({
    totalProcessed: z.number(),
    summary: z.string(),
  }),
  execute: async ({ inputData }) => {
    const total = inputData.results.length;
    const intentCounts = inputData.results.reduce((acc, result) => {
      acc[result.intent] = (acc[result.intent] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log(`\n📊 Email Processing Complete!`);
    console.log(`   Total emails processed: ${total}`);
    console.log(`   Intent breakdown:`, intentCounts);
    console.log(`   Workflow ended here - all emails processed\n`);
    
    const summary = `Processed ${total} emails: ${Object.entries(intentCounts)
      .map(([intent, count]) => `${count} ${intent}`)
      .join(', ')}`;
    
    return {
      totalProcessed: total,
      summary: summary,
    };
  },
});

// Main Email Processing Workflow - Simple Linear Flow
export const emailProcessingWorkflow = createWorkflow({
  id: 'email-processing-workflow',
  description: 'Simple email processing with intent routing',
  inputSchema: z.object({
    maxEmails: z.number().default(5).optional(),
  }),
  outputSchema: z.object({
    totalProcessed: z.number(),
    summary: z.string(),
  }),
})
  .then(fetchEmailsStep)
  .then(analyzeAndRouteStep)
  .then(summaryStep)
  .commit();