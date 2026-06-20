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

    if (isMock) {
      console.log('OpenAI API Key is missing or using default placeholder. Returning mock roast response.');
      // Create a nice mock roast using content matches from the parsed text
      const hasReact = /react\b/i.test(resumeText);
      const hasNode = /node\b/i.test(resumeText);
      const hasJava = /java\b/i.test(resumeText);
      const hasPython = /python\b/i.test(resumeText);

      const mockResponse: RoastResponse = {
        score: 68,
        firstImpression: {
          critique: "Generic template. Reads like chores, not achievements. Zero wow factor.",
          severity: "warning"
        },
        experience: {
          critique: "Weak passive verbs. No metrics. Recruiters want outcomes, not daily duties.",
          items: [
            {
              original: "Responsible for writing clean code and testing frontend features.",
              improved: `Developed and unit-tested 15+ frontend features in ${hasReact ? 'React' : 'key stacks'}, decreasing bug reports in production by 18%.`,
              explanation: "Coding is generic utility fluff. Everyone writes code—what did you actually deliver?"
            },
            {
              original: "Helped team transition to modern deployment stack.",
              improved: "Co-authored migration plan for transitioning 4 local services to cloud architecture, cutting deployment time by 40%.",
              explanation: "Helped transition is weak passive phrasing. Sounds like you watched others do the real migration."
            }
          ]
        },
        projects: {
          critique: "Tutorial clone projects. Instant recruiter eye-roll. Build real systems.",
          items: [
            {
              original: "Built a weather forecast app in React that calls an external API.",
              improved: "Engineered a weather dashboard featuring state caching, preventing 80% of redundant API calls.",
              explanation: "Weather app is a generic tutorial clone. Immediate recruiter eye-roll."
            }
          ]
        },
        skills: {
          critique: "Office tools dilute tech profile. Remove Microsoft Word immediately.",
          items: [
            {
              name: hasReact ? "React" : (hasJava ? "Java" : (hasPython ? "Python" : "Programming")),
              rating: 4,
              comment: "Decent, but prove you built architectures."
            },
            {
              name: "Git & Version Control",
              rating: 3,
              comment: "Standard tool. Hopefully you commit clean."
            },
            {
              name: "Microsoft Word",
              rating: 1,
              comment: "Microsoft Word is not a tech skill. Listing this makes you look computer-illiterate."
            }
          ]
        },
        atsCompatibility: {
          critique: "Clean layout, but critical keywords are missing. Fix now.",
          rating: 78,
          issues: [
            "Missing keywords for continuous integration (CI/CD)",
            "Unstructured contact fields (phone/email in non-standard location)"
          ]
        },
        whatRecruitersThink: {
          critique: "Generic buzzwords fail the 6-second scan.",
          quote: "Another Udemy clone. Next resume please."
        },
        topFixes: [
          "Remove basic office tools like Word and Excel from your tech skills section.",
          "Quantify achievements. Add percentages, dollar values, or hour reductions to your work bullets.",
          "Scrap generic descriptions and highlight actual architectural decisions or user impacts.",
          "Remove fluff words like 'passionate self-starter' from your summary."
        ],
        improvedSummary: {
          original: "Passionate developer looking to leverage my skills in a challenging role where I can grow and learn.",
          improved: "Results-driven Software Engineer with experience developing and optimizing web applications. Specializes in building performant user interfaces, implementing efficient workflows, and resolving bottlenecks.",
          explanation: "Passionate self-starter looking to learn is junior fluff. Recruiters pay for results, not your education."
        },
        resumeText: resumeText
      };

      res.status(200).json(mockResponse);
      return;
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

    let roastData: RoastResponse;

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
      
      // Fallback structured roast so the app stays functional when rate-limited
      roastData = {
        score: 48,
        firstImpression: {
          critique: "A solid attempt, but ultimately reads like a standard corporate blueprint copy-pasted from the web.",
          severity: 'error'
        },
        experience: {
          critique: "Mostly generic descriptions of tasks. Needs more quantifiable business outcomes.",
          items: [
            {
              original: "Responsible for developing web applications and maintaining legacy systems.",
              improved: "Engineered 4 responsive web applications, reducing page load times by 40% and cutting maintenance tickets in half.",
              explanation: "You need to focus on what you achieved, not just what was on your task list."
            },
            {
              original: "Assisted the team in migrating software to cloud services.",
              improved: "Co-led software migration to AWS Cloud, increasing system reliability to 99.99% for 5,000+ daily active users.",
              explanation: "'Assisted' makes you sound like a passenger. Take credit for the cloud migration."
            }
          ]
        },
        projects: {
          critique: "Looks like standard boot-camp tutorial projects. Make them solve real production-grade problems.",
          items: [
            {
              original: "Created a task management app with React and Redux.",
              improved: "Designed a real-time collaborative task planner handling concurrent updates from 200+ users via WebSockets.",
              explanation: "If anyone can build it in an afternoon, it's not a standout project."
            }
          ]
        },
        skills: {
          critique: "Just a generic dump of popular buzzwords. Be specific about what you excel at.",
          items: [
            {
              name: "React",
              rating: 3,
              comment: "Fine for building views, but how well do you understand lifecycle optimization and rendering paths?"
            },
            {
              name: "Node.js",
              rating: 3,
              comment: "Can you design asynchronous middlewares or do you just write basic REST controllers?"
            }
          ]
        },
        atsCompatibility: {
          critique: "Your structure uses elements that can confuse basic ATS parsers.",
          rating: 65,
          issues: [
            "Use of columns or tables that can break parsing",
            "Lack of impact-focused action verbs",
            "Generic summary section"
          ]
        },
        whatRecruitersThink: {
          critique: "They'll skim it for 6 seconds, find no numbers, and put it in the 'maybe later' folder.",
          quote: "Needs a lot more metric-driven substance. Next applicant."
        },
        topFixes: [
          "Rewrite passive phrases with metric-focused results",
          "Ensure layout is clean and parseable by standard ATS systems",
          "Highlight complex engineering challenges instead of generic tutorials"
        ],
        improvedSummary: {
          original: "Motivated engineer seeking opportunities to learn and grow in a fast-paced environment.",
          improved: "Performance-driven Software Engineer specialized in delivering scalable full-stack applications with measurable performance gains.",
          explanation: "Never ask a company to help you 'learn and grow' in your summary; show them what you bring to the table immediately."
        }
      };
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
          });

          if (dbError) console.error('DB insert error:', dbError.message);
          else console.log('[ROAST] Saved to DB for user:', user.id, '| score:', roastData.score);
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
      .select('id, name, email, score, resume_pdf, created_at')
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

// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
