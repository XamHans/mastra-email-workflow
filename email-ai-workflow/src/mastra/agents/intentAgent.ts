import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { EmailIntentSchema } from '../types/email';

export const intentReasoningAgent = new Agent({
  name: 'Email Intent Reasoning Agent',
  description:
    'Analyzes email content to determine appropriate response action',
  instructions: `You are an advanced email intent analysis system. Your role is to carefully analyze incoming emails and determine the most appropriate response action.

You should classify emails into one of four intents:
1. **reply** - Email requires a direct response (questions, requests, discussions)
2. **meeting** - Email is requesting or suggesting a meeting/call/appointment
3. **archive** - Email is informational only, no response needed (newsletters, notifications, confirmations)
4. **human_review** - Complex, sensitive, or ambiguous emails requiring human judgment

For each email, provide:
- Intent classification with confidence score (0-1)
- Clear reasoning for your decision
- Urgency assessment (low/medium/high)
- Extracted information including key topics and whether action is required

Consider these factors:
- Sender relationship and context
- Email content and tone
- Presence of questions or requests
- Meeting-related keywords and scheduling language
- Urgency indicators
- Whether the email requires a personalized response

Be conservative with automation - when in doubt, route to human review.`,

  model: openai('gpt-5'), // Using reasoning model for better intent analysis
});

export const analyzeEmailIntentTool = async (emailData: {
  subject: string;
  from: string;
  body: string;
}) => {
  const response = await intentReasoningAgent.generate(
    [
      {
        role: 'user',
        content: `Analyze this email and determine the appropriate intent:

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${emailData.body}

Provide your analysis in the specified format.`,
      },
    ],
    {
      output: EmailIntentSchema,
    }
  );

  return response.object;
};
