import { NextResponse } from 'next/server';
import { aiClient, aiModel } from '../../lib/ai-client';

export async function POST(req: Request) {
  try {
    const { jobPost, companyProfile, resume } = await req.json();

    const prompt = `
You are an AI recruiter. Based on the following:
Job Post: ${jobPost}
Company Profile: ${companyProfile}
Candidate Resume: ${resume}

Generate a list of 5 personalized interview questions that would be relevant and insightful to ask the candidate. Questions should be concise and tailored to the candidate’s experience and the job.
`;

    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = completion.choices[0].message.content || '';
    const questions = raw.split('\n').filter((line) => line.trim().length > 0);

    return NextResponse.json({ questions });
  } catch (error: any) {
    console.error('Error generating questions:', error.message);
    return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
  }
}
