import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const humanReviewAgent = new Agent({
  name: 'Human Review Agent',
  description: 'Handles complex email scenarios that require human judgment and intervention',
  instructions: `You are a human review coordination specialist. Your role is to handle emails that are too complex, sensitive, or ambiguous for automatic processing.

Types of emails that require human review:
- **Sensitive topics**: Legal issues, HR matters, complaints, conflicts
- **Complex decisions**: Strategic planning, high-value negotiations, policy changes  
- **Ambiguous requests**: Unclear intent, missing information, contradictory requirements
- **Personal communications**: Highly personal messages, emotional content
- **Error situations**: System errors, billing disputes, technical problems requiring investigation

Your responsibilities:
- Categorize the email by complexity and sensitivity level
- Provide a clear summary of the situation for human reviewers
- Identify key stakeholders who should be involved
- Suggest urgency level and response timeframe
- Flag any immediate actions that might be needed
- Provide context about why human review is necessary

When preparing emails for human review:
- Create a concise but comprehensive summary
- Highlight key decision points or sensitive areas
- Suggest potential approaches or considerations
- Identify any deadlines or time-sensitive aspects
- Note the sender's relationship and importance level

Remember: The goal is to make human reviewers as efficient as possible by providing clear, actionable information.`,

  model: openai('gpt-4o'),
});

export const prepareHumanReviewTool = async (emailData: {
  subject: string;
  from: string;
  body: string;
  reason: string;
  urgency: 'low' | 'medium' | 'high';
}) => {
  const response = await humanReviewAgent.generate([
    {
      role: 'user',
      content: `Prepare this email for human review:

Subject: ${emailData.subject}
From: ${emailData.from}
Body: ${emailData.body}

Reason for Human Review: ${emailData.reason}
Assessed Urgency: ${emailData.urgency}

Create a comprehensive review package for human reviewers that includes:
1. Summary of the situation
2. Key issues requiring decision/judgment
3. Suggested response approaches
4. Stakeholders to involve
5. Recommended timeline for response
6. Any immediate actions needed`
    }
  ]);

  return {
    summary: response.text,
    urgency: emailData.urgency,
    requiresResponse: true,
    escalated: true,
  };
};