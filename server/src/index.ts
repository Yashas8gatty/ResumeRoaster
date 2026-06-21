import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdf from 'pdf-parse';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

// Supabase anon client — for signIn / getUser (publishable key)
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Supabase admin client — for admin.createUser + DB inserts (bypasses RLS)
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Helper to send real-time Discord alerts when events trigger
async function sendDiscordNotification(content: string) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl || webhookUrl.trim() === '' || webhookUrl.includes('your_discord_webhook')) {
    return;
  }
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
  } catch (err) {
    console.error('Failed to send Discord notification:', err);
  }
}

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Setup Multer for memory storage (we don't need to write to disk)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  }
});

// Initialize OpenAI client configured to use Gemini's OpenAI-compatible endpoint
const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
});

// Type definitions for the structured OpenAI output
interface RoastResponse {
  score: number;
  firstImpression: {
    critique: string;
    severity: 'error' | 'warning' | 'success';
  };
  experience: {
    critique: string;
    items: Array<{
      original: string;
      improved: string;
      explanation: string;
    }>;
  };
  projects: {
    critique: string;
    items: Array<{
      original: string;
      improved: string;
      explanation: string;
    }>;
  };
  skills: {
    critique: string;
    items: Array<{
      name: string;
      rating: number; // 1-5 stars
      comment: string;
    }>;
  };
  atsCompatibility: {
    critique: string;
    rating: number; // 0-100
    issues: string[];
  };
  whatRecruitersThink: {
    critique: string;
    quote: string;
  };
  topFixes: string[];
  improvedSummary: {
    original: string;
    improved: string;
    explanation: string;
  };
  resumeText?: string;
}

function generateHeuristicRoast(resumeText: string): RoastResponse {
  const lines = resumeText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Extract potential skills
  const commonSkills = [
    'React', 'Angular', 'Vue', 'Next.js', 'TypeScript', 'JavaScript', 'Python', 'Java', 'C++', 'Rust', 'Go',
    'HTML', 'CSS', 'Tailwind', 'SQL', 'PostgreSQL', 'MongoDB', 'MySQL', 'Redis', 'Docker', 'Kubernetes', 'AWS',
    'GCP', 'Azure', 'Git', 'GitHub', 'CI/CD', 'Jenkins', 'Linux', 'Node.js', 'Express', 'Django', 'Flask',
    'Spring Boot', 'Figma', 'Microsoft Word', 'Microsoft Excel', 'PowerPoint'
  ];
  const foundSkills = commonSkills.filter(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(resumeText);
  });
  
  // Default fallback if no skills found
  if (foundSkills.length === 0) {
    foundSkills.push('Software Development', 'Git', 'Microsoft Word');
  }

  // 2. Extract potential bullets/experiences
  const bullets = lines.filter(line => {
    return /^[•\-\*\▪\+o]\s*/.test(line) || (line.length > 40 && line.length < 180 && !line.includes(':'));
  }).map(line => line.replace(/^[•\-\*\▪\+o]\s*/, ''));

  const expBullets: string[] = [];
  const projBullets: string[] = [];
  
  bullets.forEach(b => {
    const lower = b.toLowerCase();
    if (lower.includes('project') || lower.includes('app') || lower.includes('system') || lower.includes('api') || lower.includes('clone') || lower.includes('build')) {
      projBullets.push(b);
    } else if (lower.includes('work') || lower.includes('led') || lower.includes('manage') || lower.includes('collaborate') || lower.includes('respons') || lower.includes('develop')) {
      expBullets.push(b);
    } else {
      if (expBullets.length <= projBullets.length) {
        expBullets.push(b);
      } else {
        projBullets.push(b);
      }
    }
  });

  const defaultExp = [
    "Responsible for writing clean code and testing frontend features.",
    "Worked with cross-functional teams to deliver software updates."
  ];
  const defaultProj = [
    "Built a task manager application in React and Redux.",
    "Developed a personal portfolio site to show coding projects."
  ];

  const finalExp = expBullets.length > 0 ? expBullets.slice(0, 3) : defaultExp;
  const finalProj = projBullets.length > 0 ? projBullets.slice(0, 2) : defaultProj;

  let originalSummary = "Passionate developer seeking opportunities to learn and grow in a fast-paced environment.";
  for (const line of lines) {
    if (line.length > 80 && line.length < 250 && !line.includes('•') && !line.includes('-') && !line.includes('*')) {
      originalSummary = line;
      break;
    }
  }

  const getSkillComment = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('word') || n.includes('excel') || n.includes('powerpoint')) {
      return { rating: 1, comment: `${name} is not a tech skill. Listing this makes you look computer-illiterate.` };
    }
    if (n.includes('react') || n.includes('next') || n.includes('typescript') || n.includes('javascript')) {
      return { rating: 3, comment: `Knowing basic ${name} syntax is cute, but do you know how rendering loops and state managers actually work?` };
    }
    if (n.includes('git') || n.includes('github')) {
      return { rating: 3, comment: `You know how to push. Hopefully you don't commit direct to main.` };
    }
    return { rating: 3, comment: `Decent utility skill, but it's listed without any architectural context.` };
  };

  return {
    score: Math.floor(Math.random() * 20) + 40,
    firstImpression: {
      critique: "A standard textbook layout. Looks like a chore list, not a highlight reel. Lacks measurable output.",
      severity: "error"
    },
    experience: {
      critique: "A list of duties with zero quantifiable business impact. Recruiters need outcomes, not chores.",
      items: finalExp.map(item => {
        const words = item.split(' ').slice(0, 5).join(' ');
        return {
          original: item,
          improved: `Engineered and optimized core flows related to ${words}, leading to a 28% reduction in latency and saving 8 team-hours weekly.`,
          explanation: "Coding tasks are generic fluff. Tell us the actual outcome and time saved."
        };
      })
    },
    projects: {
      critique: "Standard tutorial projects. Build real-world high-throughput applications to get noticed.",
      items: finalProj.map(item => {
        const words = item.split(' ').slice(0, 5).join(' ');
        return {
          original: item,
          improved: `Designed and deployed a highly scalable architecture for ${words}, supporting 2,000+ daily active users.`,
          explanation: "If a junior dev can copy this from a YouTube tutorial, it's not a differentiator."
        };
      })
    },
    skills: {
      critique: "A dry dump of buzzwords. Try grouping them and removing basic desktop tools.",
      items: foundSkills.slice(0, 4).map(skill => {
        const commentData = getSkillComment(skill);
        return {
          name: skill,
          rating: commentData.rating,
          comment: commentData.comment
        };
      })
    },
    atsCompatibility: {
      critique: "Unstructured tables, multi-column setups, and missing core keywords will confuse basic ATS parsers.",
      rating: 64,
      issues: [
        "Unparseable grid columns or icons detected",
        "No measurable success indicators in job achievements",
        "Too many generic keywords diluting matching accuracy"
      ]
    },
    whatRecruitersThink: {
      critique: "Another carbon copy of 200 other applications today. Skimmed and filed under 'No'.",
      quote: "No metrics, no interest. Next resume please."
    },
    topFixes: [
      "Remove basic tools like Word and PowerPoint from your skills section.",
      "Add quantifiable statistics (percentages, hours saved) to every job bullet.",
      "Rewrite passive verbs ('responsible for', 'assisted') with active engineering decisions."
    ],
    improvedSummary: {
      original: originalSummary,
      improved: "Performance-focused developer specializing in building scalable software systems, optimizing workflows, and improving user retention.",
      explanation: "Remove junior clichés like 'seeking learning opportunities'. Start with what you bring to the table immediately."
    },
    resumeText: resumeText
  };
}

app.post('/api/roast', upload.single('resume'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
       res.status(400).json({ error: 'Please upload a PDF resume.' });
       return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const isMock = !apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '';

    // Parse PDF to extract text
    let parsedPdf;
    try {
      parsedPdf = await pdf(req.file.buffer);
    } catch (pdfError: any) {
      console.error('PDF parsing error:', pdfError);
      res.status(400).json({ error: 'Failed to parse PDF file. Ensure it is not password protected or corrupted.' });
      return;
    }

    const resumeText = parsedPdf.text;
    if (!resumeText || resumeText.trim().length < 50) {
      res.status(400).json({ error: 'We could not extract enough text from your resume. Is it a scanned image?' });
      return;
    }

    let roastData!: RoastResponse;
    let isRoastGenerated = false;

    if (isMock) {
      console.log('OpenAI API Key is missing or using default placeholder. Using mock roast response.');
      roastData = generateHeuristicRoast(resumeText);
      isRoastGenerated = true;
    }

    // Create system instruction for OpenAI
    const systemPrompt = `You are "Resume Roast", a savage, cynical, dark-humored, and highly opinionated resume reviewer who roasts resumes with zero sugar-coating and absolutely zero empathy. Your tone is extremely brutal, mockingly sarcastic, and contains 100% pure unfiltered violence. You are a seasoned recruiter who is utterly exhausted by lazy candidates and hates clichés. You do not hold back—your goal is to mock the candidate's life choices and crush their ego. Do NOT try to be constructive, helpful, or act like a mentor/HR manager. Do NOT give polite career suggestions or advice. Your job is to point out their incompetence and laugh at their failures in a sharp, witty, and devastating way. 

CRITICAL CONCISENESS RULES:
All critiques, quotes, descriptions, and comments MUST be extremely short, sharp, and direct. Use maximum 10-15 words for any single critique, comment, or quote. Cut out any preambles, greetings, or filler words. Every word must hurt, and every response must be brief.

CRITICAL CRITIQUE RULES FOR EACH SECTION:
1. Roast ONLY the currently displayed section. STRICTLY analyze only the text within that specific section.
2. Do NOT reference other resume sections, improvements, generated rewrites, hidden context, future sections, or assumptions.
3. If the section does not mention something: DO NOT mention it. (e.g. Do NOT say "Your patent is strong" if a patent does not appear in the text).
4. No invented achievements. No cross-section references.

CRITICAL ORIGINAL TEXT RULES:
- The "original" fields in "experience.items", "projects.items", and "improvedSummary" MUST be exact verbatim quotes (word-for-word copy) of real bullet points, job descriptions, project lines, or summaries actually present in the candidate's resume.
- Never invent, summarize, or generalize any projects, work experiences, or skills.
- If the candidate's resume does not have a projects section or any project descriptions, set "projects.items" to an empty array [].
- If they do not have an experience section, set "experience.items" to an empty array [].
- If they do not list any skills, set "skills.items" to an empty array [].
- Never hallucinate fake companies, technologies, or job achievements. If it's not in the resume text, it does not exist.

RECRUITER REACTION RULES:
Write like a recruiter reviewing the section text. Use this scale:
- SEVERE: if generic, repetitive, vague
- MODERATE: if decent but weak
- PRAISE: if genuinely strong
Never force positivity. Never roast good content.

ROAST FORMAT FOR WEAK/MODERATE ITEMS:
If a section or item is weak/moderate, write ONLY a single, extremely brutal, cynical, and sarcastic roast criticizing it. Do NOT include any prefixes, labels, or sections like "🔥 Recruiter Reaction", "Problem:", "Example:", "Impact:", or "Fix:". Simply output the direct, savage roast text. Keep it under 15 words.

Example of weak critique format:
"This summary is pure junior-level fluff that says absolutely nothing of value."

APPRECIATION FORMAT FOR STRONG ITEMS:
If a section or item is genuinely strong, write a single positive reaction explaining why. Do NOT include any prefixes, labels, or sections. Keep it under 12 words.

Example of strong critique format:
"Good use of measurable outcomes. Instantly builds recruiter trust."

Analyze the provided resume text and generate a structured JSON roast. You MUST return ONLY a JSON object that adheres strictly to the following TypeScript interface:

interface RoastResponse {
  score: number; // Overall resume score from 0 to 100 based on standard industry expectations.
  firstImpression: {
    critique: string; // A 1-2 sentence dry, highly cynical, and funny first impression. MAXIMUM 20 WORDS.
    severity: 'error' | 'warning' | 'success'; // 'error' if bad/cliché, 'warning' if meh, 'success' if outstanding.
  };
  experience: {
    critique: string; // A direct, biting roast of their job experience section (e.g. lack of metrics). MAXIMUM 20 WORDS. NO HR/MENTOR SUGGESTIONS.
    items: Array<{
      original: string; // A weak/unimpressive bullet point or phrase found in the experience section.
      improved: string; // The improved, high-impact version of that bullet point.
      explanation: string; // A direct, biting, and savage roast of why this bullet point is terrible (adhering strictly to the ROAST FORMAT or APPRECIATION FORMAT above).
    }>; // Provide 2-3 key bullet point improvements.
  };
  projects: {
    critique: string; // A direct, biting roast of their projects (e.g. generic tutorial projects). MAXIMUM 20 WORDS. NO HR/MENTOR SUGGESTIONS.
    items: Array<{
      original: string; // A weak project description line or detail.
      improved: string; // A stronger project bullet or framing.
      explanation: string; // A direct, biting, and savage roast of why this project is terrible (adhering strictly to the ROAST FORMAT or APPRECIATION FORMAT above).
    }>; // Provide 1-2 project improvements.
  };
  skills: {
    critique: string; // A direct, biting roast of their skills list (e.g. office tools). MAXIMUM 20 WORDS. NO HR/MENTOR SUGGESTIONS.
    items: Array<{
      name: string; // The skill name.
      rating: number; // Your rating of this skill on their resume from 1 to 5.
      comment: string; // A direct, biting, and savage roast of this skill (adhering strictly to the ROAST FORMAT or APPRECIATION FORMAT above).
    }>; // Roast 3-5 of their skills.
  };
  atsCompatibility: {
    critique: string; // A direct, biting roast of their ATS compatibility. MAXIMUM 20 WORDS. NO HR/MENTOR SUGGESTIONS.
    rating: number; // 0-100 score of ATS readability.
    issues: string[]; // List of specific issues.
  };
  whatRecruitersThink: {
    critique: string; // A short commentary on what an actual tired recruiter thinks. MAXIMUM 20 WORDS.
    quote: string; // A witty, cynical quote representing a recruiter's internal monologue. MAXIMUM 12 WORDS.
  };
  topFixes: string[]; // A clean array of 3-5 immediate actionable things they must fix.
  improvedSummary: {
    original: string; // Their current summary (or a synthesized summary if they don't have one).
    improved: string; // A punchy, modern, results-oriented summary.
    explanation: string; // A direct, biting, and savage roast of why their original summary was trash (adhering strictly to the ROAST FORMAT or APPRECIATION FORMAT above).
  };
}

Do not include any markdown backticks (\`\`\`json ... \`\`\`) in your response. Return ONLY raw valid JSON matching this schema.`;

    let isFallbackMock = false;

    if (!isRoastGenerated) {
      try {
        const response = await openai.chat.completions.create({
          model: 'gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: `Here is the resume content to roast:\n\n${resumeText}` }
          ],
          response_format: { type: 'json_object' },
          temperature: 1.0
        });

        const responseText = response.choices[0]?.message?.content;
        if (!responseText) {
          throw new Error('Received empty response from OpenAI.');
        }
        roastData = JSON.parse(responseText);
      } catch (apiErr: any) {
        console.warn('[ROAST] Gemini API call failed (likely Rate Limit 429). Falling back to mock roast. Error:', apiErr.message || apiErr);
        roastData = generateHeuristicRoast(resumeText);
        isFallbackMock = true;
      }
    } else {
      isFallbackMock = true;
    }

    roastData.resumeText = resumeText;

    // ── Save to DB if user is authenticated ───────────────────────────────
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const { data: { user } } = await supabase.auth.getUser(token);
        if (user) {
          // Upload PDF to Supabase Storage (admin client bypasses RLS)
          const fileName = `${user.id}/${Date.now()}.pdf`;
          const { error: uploadError } = await supabaseAdmin.storage
            .from('resumes')
            .upload(fileName, req.file!.buffer, { contentType: 'application/pdf', upsert: false });

          const { data: publicUrlData } = supabaseAdmin.storage.from('resumes').getPublicUrl(fileName);
          const pdfUrl = uploadError ? '' : (publicUrlData?.publicUrl || '');

          const { error: dbError } = await supabaseAdmin.from('roasts').insert({
            user_id: user.id,
            name: user.user_metadata?.name || '',
            email: user.email || '',
            score: roastData.score,
            resume_pdf: pdfUrl,
            is_mock: isFallbackMock
          });

          if (dbError) {
            console.error('DB insert error:', dbError.message);
          } else {
            console.log('[ROAST] Saved to DB for user:', user.id, '| score:', roastData.score);
            
            // Send Discord Webhook Notification
            const userName = user.user_metadata?.name || 'Unknown User';
            const userEmail = user.email || 'unknown@email.com';
            if (isFallbackMock) {
              await sendDiscordNotification(`⚠️ **Mock Roast Fallback** served to user **${userName}** (${userEmail}).\n📈 Score: **${roastData.score}**`);
            } else {
              await sendDiscordNotification(`🔥 **New Resume Roast** generated for user **${userName}** (${userEmail}).\n📈 Score: **${roastData.score}**\n📄 PDF: ${pdfUrl || 'None'}`);
            }
          }
        }
      } catch (saveErr) {
        console.error('Failed to save roast to DB (non-fatal):', saveErr);
      }
    }

    res.status(200).json(roastData);

  } catch (error: any) {
    console.error('Error roasting resume:', error);
     res.status(500).json({ error: error.message || 'An error occurred during the roast process.' });
  }
});


app.post('/api/chat', async (req: express.Request, res: express.Response) => {
  try {
    const { messages, resumeText, roastData } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'Invalid messages array.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const isMock = !apiKey || apiKey === 'your_openai_api_key_here' || apiKey === 'your_gemini_api_key_here' || apiKey.trim() === '';

    if (isMock) {
      const mockReplies = [
        "That's a very cute explanation. Unfortunately, the market doesn't pay for effort, it pays for results. Try putting some metrics on that React project.",
        "Oh, you 'coordinated communication'? That's a fancy way of saying you sent emails. Delete it or tell me what it actually built.",
        "I read that. I still don't understand why a company would hire you over the other 500 applicants who also know basic Git. What's your actual edge?",
        "Interesting defense. But my initial score stands. If you want to raise it, start by rewriting that generic career summary.",
        "Let's be real: no recruiter is reading past your first job bullet if it starts with 'responsible for'. Rewrite it using active verbs."
      ];
      const randomReply = mockReplies[Math.floor(Math.random() * mockReplies.length)];
      
      await new Promise(resolve => setTimeout(resolve, 800));
      res.status(200).json({ content: randomReply });
      return;
    }

    const systemInstruction = `You are "Resume Roast Recruiter", the same brutally honest, dry, and sarcastic AI recruiter who previously roasted this candidate's resume. 

Here is the raw text of their resume for context:
---
${resumeText || 'Not provided'}
---

Here is the original JSON roast feedback you generated:
---
${JSON.stringify(roastData || { score: 68 })}
---

The candidate has opened a dialogue to discuss your roast, ask questions, or defend their resume.
Your goals:
1. Maintain your sharp, cynical, sarcastic recruiter persona (100% pure unfiltered violence). Do not sugarcoat anything. Be savage and mockingly funny.
2. Never drop the persona. Be defensive, condescending, and stingingly blunt if they argue, and mock their questions without giving gentle HR advice. Be extremely cynical and savage.
3. Keep your replies brutally concise (maximum 1 short sentence, under 15 words). Do not waste words. Your response should feel like a quick slap in the face. No friendly introductions or explanations. Get straight to the savage truth.
4. Reference details of their resume or your roast data (e.g. their score, their skills, or their projects) to prove you actually "read" it.`;

    let reply = "I have nothing to say to that.";

    try {
      const response = await openai.chat.completions.create({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemInstruction },
          ...messages.map((m: any) => ({
            role: m.role,
            content: m.content
          }))
        ],
        temperature: 1.0
      });
      reply = response.choices[0]?.message?.content || reply;
    } catch (apiErr) {
      console.warn('[CHAT] Gemini API chat failed. Falling back to mock recruiter response.', apiErr);
      const mockReplies = [
        "That's a very cute explanation. Unfortunately, the market doesn't pay for effort, it pays for results.",
        "Oh, you 'coordinated communication'? That's a fancy way of saying you sent emails.",
        "I read that. I still don't understand why a company would hire you over anyone else.",
        "Interesting defense. But my initial score stands. Go rewrite that generic summary.",
        "Let's be real: no recruiter is reading past your first bullet if it's that generic."
      ];
      reply = mockReplies[Math.floor(Math.random() * mockReplies.length)];
    }

    res.status(200).json({ content: reply });
  } catch (error: any) {
    console.error('Error in recruiter chat:', error);
    res.status(500).json({ error: error.message || 'An error occurred during chat.' });
  }
});

// ─── AUTH ROUTES ─────────────────────────────────────────────────────────────

// Sign Up
app.post('/api/auth/signup', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ error: 'Name, email and password are required.' });
      return;
    }

    // admin.createUser auto-confirms email — no verification email sent
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (error) {
      console.error('[SIGNUP] Error:', error.message);
      res.status(400).json({ error: error.message });
      return;
    }

    if (!data.user) {
      res.status(400).json({ error: 'Signup failed — no user returned.' });
      return;
    }

    // Sign in immediately to get a session token
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      res.status(500).json({ error: 'Account created but sign-in failed. Please log in.' });
      return;
    }

    console.log('[SIGNUP] Success — user created and signed in:', data.user.id);
    
    // Send Discord Webhook Notification on signup
    await sendDiscordNotification(`🎉 **New User Signed Up!**\n👤 Name: **${name}**\n📧 Email: **${email}**`);

    res.status(201).json({
      token: signInData.session.access_token,
      user: { id: data.user.id, email, name }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Signup failed.' });
  }
});

// Log In
app.post('/api/auth/login', async (req: express.Request, res: express.Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const name = data.user.user_metadata?.name || '';
    res.status(200).json({
      token: data.session.access_token,
      user: { id: data.user.id, email: data.user.email, name }
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Login failed.' });
  }
});

// Log Out
app.post('/api/auth/logout', async (_req: express.Request, res: express.Response) => {
  await supabase.auth.signOut();
  res.status(200).json({ message: 'Logged out.' });
});

// Get User Roast History (protected)
app.get('/api/user/history', async (req: express.Request, res: express.Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      res.status(401).json({ error: 'Unauthorized. Please log in.' });
      return;
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      res.status(401).json({ error: 'Invalid or expired session.' });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from('roasts')
      .select('id, name, email, score, resume_pdf, created_at, is_mock')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ history: data });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Failed to fetch history.' });
  }
});

// Diagnostic DB check endpoint
app.get('/api/test-db', async (_req: express.Request, res: express.Response) => {
  const diagnosticResults: any = {
    supabase_url: process.env.SUPABASE_URL ? 'Configured' : 'Missing',
    supabase_service_key: process.env.SUPABASE_SERVICE_KEY ? 'Configured' : 'Missing',
    database_table_check: null,
    storage_bucket_check: null
  };

  try {
    // 1. Test "roasts" table access
    const { data: dbData, error: dbError } = await supabaseAdmin
      .from('roasts')
      .select('id')
      .limit(1);

    if (dbError) {
      diagnosticResults.database_table_check = {
        status: 'Error',
        message: dbError.message,
        hint: 'Ensure you ran the SQL script to create the public.roasts table in the Supabase SQL editor.'
      };
    } else {
      diagnosticResults.database_table_check = {
        status: 'Success',
        message: 'Successfully queried public.roasts table.'
      };
    }

    // 2. Test "resumes" bucket access
    const { data: buckets, error: storageError } = await supabaseAdmin
      .storage
      .listBuckets();

    if (storageError) {
      diagnosticResults.storage_bucket_check = {
        status: 'Error',
        message: storageError.message,
        hint: 'Ensure your Supabase service role key is correct and Storage service is enabled.'
      };
    } else {
      const resumeBucketExists = buckets?.some(b => b.name === 'resumes');
      if (resumeBucketExists) {
        diagnosticResults.storage_bucket_check = {
          status: 'Success',
          message: 'Found resumes storage bucket.'
        };
      } else {
        diagnosticResults.storage_bucket_check = {
          status: 'Error',
          message: 'resumes bucket not found.',
          hint: 'Go to Supabase -> Storage -> New Bucket, and create a public bucket named exactly: resumes'
        };
      }
    }

    res.status(200).json(diagnosticResults);
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Diagnostic failed.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
