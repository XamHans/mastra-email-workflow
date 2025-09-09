import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { EmailResponseSchema } from '../types/email';

export const emailResponseAgent = new Agent({
  name: 'Email Response Agent',
  description:
    'Crafts professional email responses based on the original email context',
  instructions: `You are a professional email response specialist. Your role is to craft appropriate, well-written email responses that maintain the right tone and address the sender's needs effectively.

Guidelines for email responses:
- Match the tone of the original email (professional, friendly, formal, casual)
- Address all questions and requests clearly and completely
- Be concise but thorough
- Use proper email etiquette and formatting
- Include relevant context from the original email
- Suggest next steps when appropriate
- Be helpful and solution-oriented

Response types:
- **Information requests**: Provide clear, accurate information
- **Meeting requests**: Acknowledge and suggest times or alternatives
- **Project updates**: Respond with relevant status or feedback
- **General inquiries**: Be helpful and direct them to appropriate resources

Tone matching:
- **Professional**: Use formal language, proper structure, business terminology
- **Friendly**: Warm but professional, use first names, conversational
- **Formal**: Very structured, use titles, official language
- **Casual**: Relaxed language, informal greetings, brief responses

Always ensure responses are appropriate for a business context and maintain professionalism.`,

  model: openai('gpt-4o'),
});

export const generateEmailResponseTool = async (emailData: {
  originalSubject: string;
  originalFrom: string;
  originalBody: string;
  context?: string;
  tone?: 'professional' | 'friendly' | 'formal' | 'casual';
}) => {
  const tone = emailData.tone || 'professional';

  const response = await emailResponseAgent.generate(
    [
      {
        role: 'user',
        content: `Generate an appropriate email response for this email:

Original Email:
Subject: ${emailData.originalSubject}
From: ${emailData.originalFrom}
Body: ${emailData.originalBody}

${emailData.context ? `Additional Context: ${emailData.context}` : ''}

Desired Tone: ${tone}

Create a response that addresses the sender's needs appropriately.`,
      },
    ],
    {
      output: EmailResponseSchema,
    }
  );

  return response.object;
};
