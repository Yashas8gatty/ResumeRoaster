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
  isMock?: boolean;
}

function calculateDynamicScore(resumeText: string, bullets: string[], foundSkills: string[]): number {
  let score = 50;

  // 1. Email check
  if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(resumeText)) {
    score += 5;
  }
  // 2. Phone check
  if (/\b\d{10}\b|\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/.test(resumeText)) {
    score += 5;
  }
  // 3. GitHub or LinkedIn check
  if (/github\.com/i.test(resumeText)) score += 5;
  if (/linkedin\.com/i.test(resumeText)) score += 5;

  // 4. Metrics & quantification check
  const metricMatches = resumeText.match(/\b\d+(%|\s*percent|x|\s*k|\s*m|\s*billion|\s*million|\s*active\s*users)\b/ig) || [];
  score += Math.min(metricMatches.length * 3, 15);

  // 5. Structure & Bullets check
  if (bullets.length > 5) score += 5;
  if (bullets.length > 10) score += 5;

  // 6. Skills matched
  score += Math.min(foundSkills.length * 2, 15);

  // 7. Length check
  if (resumeText.length < 800) {
    score -= 10;
  } else if (resumeText.length > 1800 && resumeText.length < 7000) {
    score += 10;
  }

  // 8. Achievements/Accolades check
  const textLower = resumeText.toLowerCase();
  const hasHighRank = /\b(1st|2nd|3rd|first|second|third|winner|won|champion|gold\s+medal|silver\s+medal|bronze\s+medal|rank|placement)\b/i.test(textLower);
  const hasRunnerUp = /\b(runner\s*-?\s*up|runnerup|runnerups)\b/i.test(textLower);
  if (hasHighRank || hasRunnerUp) {
    score += 8;
  }

  return Math.max(38, Math.min(score, 94));
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

  // 2. Extract potential sections sequentially to group bullets by project/experience title
  const projectsList: Array<{ title: string; bullets: string[] }> = [];
  const experienceList: Array<{ title: string; bullets: string[] }> = [];
  let currentSection = 'summary';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lower = line.toLowerCase();

    if (lower.includes('experience') || lower.includes('work history') || lower.includes('employment') || lower.includes('professional background')) {
      currentSection = 'experience';
      continue;
    } else if (lower.includes('project')) {
      currentSection = 'projects';
      continue;
    } else if (lower.includes('skill') || lower.includes('technologies') || lower.includes('expertise') || lower.includes('technical skills')) {
      currentSection = 'skills';
      continue;
    } else if (lower.includes('education') || lower.includes('academic')) {
      currentSection = 'education';
      continue;
    }

    const isBullet = /^[•\-\*\▪\+o]\s*/.test(line);
    const cleanLine = line.replace(/^[•\-\*\▪\+o]\s*/, '').trim();

    if (currentSection === 'projects') {
      if (isBullet) {
        if (projectsList.length > 0) {
          projectsList[projectsList.length - 1].bullets.push(cleanLine);
        } else {
          projectsList.push({ title: 'Personal Project', bullets: [cleanLine] });
        }
      } else {
        if (line.length < 90) {
          projectsList.push({ title: line, bullets: [] });
        }
      }
    } else if (currentSection === 'experience') {
      if (isBullet) {
        if (experienceList.length > 0) {
          experienceList[experienceList.length - 1].bullets.push(cleanLine);
        } else {
          experienceList.push({ title: 'Professional Role', bullets: [cleanLine] });
        }
      } else {
        if (line.length < 90) {
          experienceList.push({ title: line, bullets: [] });
        }
      }
    }
  }

  // Filter out any titles that ended up with no bullets
  const validProjects = projectsList.filter(p => p.bullets.length > 0);
  const validExperiences = experienceList.filter(e => e.bullets.length > 0);

  // Keyword-based fallback if the structure is simple or parsed incorrectly
  const bullets = lines.filter(line => {
    return /^[•\-\*\▪\+o]\s*/.test(line) || (line.length > 40 && line.length < 180 && !line.includes(':'));
  }).map(line => line.replace(/^[•\-\*\▪\+o]\s*/, ''));

  const fallbackExp: string[] = [];
  const fallbackProj: string[] = [];

  bullets.forEach(b => {
    const lower = b.toLowerCase();
    if (lower.includes('project') || lower.includes('app') || lower.includes('system') || lower.includes('api') || lower.includes('clone') || lower.includes('build')) {
      fallbackProj.push(b);
    } else if (lower.includes('work') || lower.includes('led') || lower.includes('manage') || lower.includes('collaborate') || lower.includes('respons') || lower.includes('develop')) {
      fallbackExp.push(b);
    } else {
      if (fallbackExp.length <= fallbackProj.length) {
        fallbackExp.push(b);
      } else {
        fallbackProj.push(b);
      }
    }
  });

  const finalExp = validExperiences.length > 0
    ? validExperiences.slice(0, 8)
    : (fallbackExp.length > 0 ? fallbackExp.slice(0, 8).map(b => ({ title: 'Work Experience Bullet', bullets: [b] })) : null);

  const finalProj = validProjects.length > 0
    ? validProjects.slice(0, 8)
    : (fallbackProj.length > 0 ? fallbackProj.slice(0, 8).map(b => ({ title: 'Project Bullet', bullets: [b] })) : null);

  const defaultExp = [
    { title: "Software Engineering Duties", bullets: ["Responsible for writing clean code and testing frontend features.", "Worked with cross-functional teams to deliver software updates."] }
  ];
  const defaultProj = [
    { title: "React Task Manager", bullets: ["Built a task manager application in React and Redux.", "Developed a personal portfolio site to show coding projects."] }
  ];

  const displayExp = finalExp || defaultExp;
  const displayProj = finalProj || defaultProj;

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
    score: calculateDynamicScore(resumeText, bullets, foundSkills),
    firstImpression: {
      critique: "A standard textbook layout. Looks like a chore list, not a highlight reel. Lacks measurable output.",
      severity: "error"
    },
    experience: {
      critique: "A list of duties with zero quantifiable business impact. Recruiters need outcomes, not chores.",
      items: displayExp.map(item => {
        const titleWords = item.title.split(' ').slice(0, 5).join(' ');
        const bulletsText = item.bullets.join('; ');
        const snippet = bulletsText.length > 60 ? bulletsText.slice(0, 60) + '...' : bulletsText;
        return {
          original: `${item.title}: ${bulletsText}`,
          improved: `Lead Engineer for ${titleWords} — Re-engineered core workflows to reduce latency by 28% and save 8+ hours of weekly manual operations.`,
          explanation: `The bullets for "${titleWords}" are generic tasks (${snippet}). Quantify outcomes and technical decisions.`
        };
      })
    },
    projects: {
      critique: "Standard tutorial projects. Build real-world high-throughput applications to get noticed.",
      items: displayProj.map(item => {
        const titleWords = item.title.split(' ').slice(0, 5).join(' ');
        const bulletsText = item.bullets.join('; ');
        const snippet = bulletsText.length > 60 ? bulletsText.slice(0, 60) + '...' : bulletsText;
        return {
          original: `${item.title}: ${bulletsText}`,
          improved: `System Architecture for ${titleWords} — Designed and deployed highly scalable cloud workflows supporting 2,000+ daily active users.`,
          explanation: `Your project "${titleWords}" is described as basic tasks (${snippet}). Highlight architectural scaling and user metrics.`
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

const getApiKeys = (): string[] => {
  const keys: string[] = [];

  const keysStr = process.env.GEMINI_API_KEYS || '';
  if (keysStr.trim()) {
    keysStr.split(',').forEach(k => {
      const trimmed = k.trim();
      if (trimmed && !keys.includes(trimmed)) {
        keys.push(trimmed);
      }
    });
  }

  const singleKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '';
  const trimmedSingle = singleKey.trim();
  if (trimmedSingle && !trimmedSingle.includes('your_') && !keys.includes(trimmedSingle)) {
    keys.push(trimmedSingle);
  }

  return keys;
};

async function callGeminiWithRotation(
  systemPrompt: string,
  userPrompt: string,
  responseFormatJson: boolean = false,
  messagesArray: any[] = []
): Promise<string> {
  const keys = getApiKeys();
  if (keys.length === 0) {
    throw new Error('No API keys configured.');
  }

  let lastError: any = null;

  for (let i = 0; i < keys.length; i++) {
    const currentKey = keys[i];
    console.log(`[ROTATION] Trying API key index ${i + 1}/${keys.length}...`);

    try {
      const client = new OpenAI({
        apiKey: currentKey,
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/"
      });

      const messages = messagesArray.length > 0 ? messagesArray : [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ];

      const options: any = {
        model: 'gemini-2.5-flash',
        messages: messages,
        temperature: 1.2

      };

      if (responseFormatJson) {
        options.response_format = { type: 'json_object' };
      }

      const response = await client.chat.completions.create(options);
      const content = response.choices[0]?.message?.content;
      if (content) {
        console.log(`[ROTATION] Success with key index ${i + 1}!`);
        return content;
      }
      throw new Error('Received empty response from Gemini API.');
    } catch (err: any) {
      console.warn(`[ROTATION] Key index ${i + 1} failed. Error:`, err.message || err);
      lastError = err;
    }
  }

  throw lastError || new Error('All API keys failed.');
}

app.post('/api/roast', upload.single('resume'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'Please upload a PDF resume.' });
      return;
    }

    const keys = getApiKeys();
    const isMock = keys.length === 0;

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
      console.log('All API keys are missing. Using local heuristic roast response.');
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
  score: number; // Overall resume score from 0 to 100. This score must be dynamic and realistic: a great resume with clear metrics and projects should get 75-92, a decent one 55-74, and a weak one 30-54. Do not default every resume to under 50 just because you are roasting it.
  firstImpression: {
    critique: string; // A 1-2 sentence dry, highly cynical, and funny first impression. MAXIMUM 20 WORDS.
    severity: 'error' | 'warning' | 'success'; // 'error' if bad/cliché, 'warning' if meh, 'success' if outstanding.
  };
  experience: {
    critique: string; // A direct, biting roast of their job experience section (e.g. lack of metrics). MAXIMUM 20 WORDS. NO HR/MENTOR SUGGESTIONS.
    items: Array<{
      original: string; // The original role/company title along with its job description bullets. Combine the role title and all of its description bullets here.
      improved: string; // The improved, high-impact version of this role and its description bullets.
      explanation: string; // A direct, biting, and savage roast of why this role's details are terrible (adhering strictly to the ROAST FORMAT or APPRECIATION FORMAT above).
    }>; // Provide improvements for ALL major roles/experiences listed in the resume (do not treat each individual bullet point as a separate job; group bullets by company/role).
  };
  projects: {
    critique: string; // A direct, biting roast of their projects (e.g. generic tutorial projects). MAXIMUM 20 WORDS. NO HR/MENTOR SUGGESTIONS.
    items: Array<{
      original: string; // The original project title and its description bullets. Combine the project title and all of its description bullets here.
      improved: string; // A stronger project title and high-impact description bullets.
      explanation: string; // A direct, biting, and savage roast of why this project is terrible (adhering strictly to the ROAST FORMAT or APPRECIATION FORMAT above).
    }>; // Provide improvements for ALL major projects listed in the resume (do not treat each individual bullet point as a separate project; group bullets by project).
  };
  skills: {
    critique: string; // A direct, biting roast of their skills list (e.g. office tools). MAXIMUM 20 WORDS. NO HR/MENTOR SUGGESTIONS.
    items: Array<{
      name: string; // The skill name.
      rating: number; // Your rating of this skill on their resume from 1 to 5.
      comment: string; // A direct, biting, and savage roast of this skill (adhering strictly to the ROAST FORMAT or APPRECIATION FORMAT above).
    }>; // Roast all major skills found (up to 8 skills).
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
        const responseText = await callGeminiWithRotation(
          systemPrompt,
          `Here is the resume content to roast:\n\n${resumeText}`,
          true
        );
        roastData = JSON.parse(responseText);
      } catch (apiErr: any) {
        console.warn('[ROAST] Gemini API call failed (all keys exhausted). Falling back to local heuristics. Error:', apiErr.message || apiErr);
        roastData = generateHeuristicRoast(resumeText);
        isFallbackMock = true;
      }
    } else {
      isFallbackMock = true;
    }

    roastData.isMock = isFallbackMock;
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

    const requestApiKey = req.headers['x-api-key'] as string || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    const isMock = !requestApiKey || requestApiKey === 'your_openai_api_key_here' || requestApiKey === 'your_gemini_api_key_here' || requestApiKey.trim() === '';

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
      const messagesArray = [
        { role: 'system', content: systemInstruction },
        ...messages.map((m: any) => ({
          role: m.role,
          content: m.content
        }))
      ];
      reply = await callGeminiWithRotation("", "", false, messagesArray);
    } catch (apiErr) {
      console.warn('[CHAT] Gemini API chat failed (all keys exhausted). Falling back to local mock recruiter response.', apiErr);
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
