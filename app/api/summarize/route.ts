import { NextResponse } from 'next/server';
import { aiClient, aiModel } from '../../lib/ai-client';

export async function POST(req: Request) {
  try {
    const { questions, answers } = await req.json();

    const qaPairs = questions.map((q: string, i: number) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i]}`).join('\n\n');

    const prompt = `
You're an AI hiring interviewer.

Here is a mock interview transcript:

${qaPairs}

Please provide:
1. A professional summary of the candidate’s performance.
2. A score from 1 to 10.
3. Final feedback or recommendation for improvement.
`;

    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = completion.choices[0].message.content;
    return NextResponse.json({ summary });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to summarize' }, { status: 500 });
  }
}
