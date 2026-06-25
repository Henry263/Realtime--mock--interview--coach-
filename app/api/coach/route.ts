import { NextResponse } from 'next/server';
import { aiClient, aiModel } from '../../lib/ai-client';

type Tone = 'general' | 'technical' | 'behavioral' | 'system-design' | 'coding';
type AnswerFormat = 'prose' | 'bullets' | 'structured';
type Duration = 15 | 30 | 45 | 60;
type AnswerLength = 'short' | 'medium' | 'long' | 'extra-long';

const tonePrompts: Record<Tone, string> = {
  general: `You are a real-time interview coach. Give concise, confident answers that sound natural and professional.`,
  
  technical: `You are a technical interview coach. Focus on:
- Precise technical terminology
- Concrete examples from real experience
- Mention specific technologies, tools, or methodologies
- Be direct and demonstrate deep knowledge
- If it's about a concept, briefly explain the "why" behind it`,
  
  behavioral: `You are a behavioral interview coach. Focus on:
- Use STAR format implicitly (Situation, Task, Action, Result)
- Emphasize teamwork, leadership, and problem-solving
- Include measurable outcomes when possible
- Sound genuine and self-aware
- Show growth mindset and learning from challenges`,
  
  'system-design': `You are a system design interview coach. Focus on:
- Start with clarifying requirements
- Mention scalability, reliability, availability trade-offs
- Reference specific technologies (Redis, Kafka, PostgreSQL, etc.)
- Think out loud about bottlenecks and solutions
- Mention monitoring and observability`,
  
  coding: `You are a coding interview coach. Focus on:
- Clarify inputs, outputs, and edge cases first
- Mention time and space complexity
- Describe the approach before coding
- Think about optimization opportunities
- Mention testing strategies`
};

const formatInstructions: Record<AnswerFormat, string> = {
  prose: `FORMAT: CONVERSATIONAL PARAGRAPHS
Write in natural flowing sentences. No bullet points or headers. Just speak naturally like in a real conversation.`,
  
  bullets: `FORMAT: BULLET POINTS (REQUIRED)
You MUST format your answer using bullet points like this:
• First key point here
• Second key point here  
• Third key point here
Each bullet should be a complete, speakable sentence. DO NOT write paragraphs.`,
  
  structured: `FORMAT: STRUCTURED WITH HEADERS (REQUIRED)
You MUST format your answer with clear sections:

**Opening:** One strong opening sentence

**Key Points:**
• Point 1
• Point 2
• Point 3

**Conclusion:** One strong closing statement

DO NOT write as a plain paragraph.`,
};

const durationInstructions: Record<Duration, string> = {
  15: 'VERY SHORT interview - be extremely concise. 1-2 sentences per answer max. Get to the point immediately.',
  30: 'SHORT interview - be concise. 2-3 sentences per answer. Focus on key points only.',
  45: 'MEDIUM interview - moderate detail. 2-4 sentences. Include one brief example if relevant.',
  60: 'LONGER interview - can provide more detail. 3-5 sentences. Include examples and context.',
};

const lengthInstructions: Record<AnswerLength, { instruction: string; maxTokens: number; wordTarget: string }> = {
  'short': { 
    instruction: 'EXTREMELY BRIEF: 30-50 words MAXIMUM. 2 sentences only. One key point. No examples. Get straight to the point.',
    maxTokens: 150,
    wordTarget: '30-50 words'
  },
  'medium': { 
    instruction: 'MODERATE LENGTH: 60-100 words. 3-4 sentences. Cover 2 key points with one brief example.',
    maxTokens: 250,
    wordTarget: '60-100 words'
  },
  'long': { 
    instruction: 'DETAILED: 120-180 words. 5-7 sentences. Cover 3-4 points with specific examples and context. Provide depth.',
    maxTokens: 400,
    wordTarget: '120-180 words'
  },
  'extra-long': { 
    instruction: 'COMPREHENSIVE: 200-300 words. 8-12 sentences. Full detailed answer with multiple specific examples, context, metrics, and thorough explanation. Cover all relevant aspects.',
    maxTokens: 600,
    wordTarget: '200-300 words'
  },
};

// Auto-detect tone from question
async function detectTone(question: string): Promise<Tone> {
  const prompt = `Classify this interview question into ONE category. Reply with ONLY the category name, nothing else.

Categories:
- behavioral (about past experiences, teamwork, conflicts, strengths, weaknesses, leadership, handling situations, personal qualities, "tell me about yourself", "tell me about a time", working with others)
- technical (about specific technologies, concepts, tools, "how does X work", "what is the difference between", explaining technical concepts, debugging approaches)
- system-design (designing systems, architecture, scalability, databases, APIs, "how would you design", handling traffic, infrastructure)
- coding (writing code, algorithms, data structures, optimization, "write a function", complexity analysis)
- general (company fit, salary, availability, logistics, or unclear category)

Question: "${question}"

Category:`;

  try {
    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      max_tokens: 20,
    });
    
    const detected = (completion.choices[0].message.content || '').toLowerCase().trim();
    
    if (detected.includes('behavioral')) return 'behavioral';
    if (detected.includes('technical')) return 'technical';
    if (detected.includes('system-design') || detected.includes('system design')) return 'system-design';
    if (detected.includes('coding')) return 'coding';
    return 'general';
  } catch {
    return 'general';
  }
}

export async function POST(req: Request) {
  try {
    const { 
      question, 
      context,
      jobRequirements,
      cv,
      tone = 'auto',
      format = 'prose',
      duration = 30,
      answerLength = 'medium',
      autoDetect = true 
    } = await req.json();

    // Auto-detect tone if enabled
    let finalTone: Tone = tone === 'auto' ? 'general' : tone;
    let detectedTone: Tone | null = null;
    
    if (autoDetect || tone === 'auto') {
      detectedTone = await detectTone(question);
      if (tone === 'auto') {
        finalTone = detectedTone;
      }
    }

    const toneInstruction = tonePrompts[finalTone] || tonePrompts.general;
    const formatInstruction = formatInstructions[format as AnswerFormat] || formatInstructions.prose;
    const durationInstruction = durationInstructions[duration as Duration] || durationInstructions[30];
    const lengthConfig = lengthInstructions[answerLength as AnswerLength] || lengthInstructions.medium;

    const prompt = `${toneInstruction}

=== CRITICAL: ANSWER LENGTH ===
${lengthConfig.instruction}
TARGET: ${lengthConfig.wordTarget}
===============================

=== CRITICAL: ANSWER FORMAT ===
${formatInstruction}
===============================

${jobRequirements ? `JOB REQUIREMENTS:
${jobRequirements}
` : ''}${cv ? `CANDIDATE BACKGROUND:
${cv}
` : ''}${context ? `ADDITIONAL CONTEXT:
${context}
` : ''}
The interviewer just asked:
"${question}"

Provide:
1. **ANSWER** (${lengthConfig.wordTarget}): Follow the FORMAT instructions above EXACTLY. ${format === 'bullets' ? 'USE BULLET POINTS (•).' : format === 'structured' ? 'USE HEADERS AND SECTIONS.' : 'Use conversational paragraphs.'}

2. **FOLLOW-UP** (1-2 sentences max): One additional point to add if they dig deeper.`;

    const completion = await aiClient.chat.completions.create({
      model: aiModel,
      messages: [
        { role: 'system', content: `You are an interview coach. Your answers MUST be ${lengthConfig.wordTarget} and MUST follow the ${format.toUpperCase()} format strictly. ${format === 'bullets' ? 'Always use bullet points (•) for key points.' : format === 'structured' ? 'Always use headers like **Opening:**, **Key Points:**, **Conclusion:**' : 'Write in natural paragraphs.'}` },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: lengthConfig.maxTokens,
    });

    const response = completion.choices[0].message.content;
    return NextResponse.json({ 
      response,
      detectedTone,
      usedTone: finalTone 
    });
  } catch (error: any) {
    console.error('Coach error:', error.message);
    return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
  }
}
