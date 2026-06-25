import { NextResponse } from 'next/server';
import { aiClient, aiModel } from '../../../lib/ai-client';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text || text.trim().length < 5) {
      return NextResponse.json({ isQuestion: false, reason: 'Too short' });
    }

    const prompt = `Analyze this text from an interview conversation and determine if it's a QUESTION from an interviewer or a STATEMENT/ANSWER from a candidate.

Text: "${text}"

Rules:
- Questions typically ask for information, experience, opinions, or explanations
- Questions often start with: What, How, Why, Tell me, Can you, Could you, Describe, Explain, Walk me through
- Statements typically provide information, describe experiences, or give answers
- Filler phrases like "Okay", "I see", "That makes sense" are NOT questions

Respond with ONLY one word: QUESTION or STATEMENT`;

    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 10,
    });

    const response = (completion.choices[0].message.content || '').toLowerCase().trim();
    const isQuestion = response.includes('question');

    return NextResponse.json({ 
      isQuestion,
      classification: response,
      text: text.substring(0, 100)
    });
  } catch (error: any) {
    console.error('Check question error:', error.message);
    // On error, assume it's a question to not miss anything
    return NextResponse.json({ isQuestion: true, error: true });
  }
}
