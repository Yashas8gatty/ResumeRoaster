<img width="1774" height="887" alt="rrlogoc" src="https://github.com/user-attachments/assets/6b797545-b1bb-411d-ba95-8ee0d9bbcf0c" />



> **Upload your resume. Get roasted. Get hired.**
> 
> Resume Roast is an AI-powered resume review platform that reads your resume like a cynical recruiter with 87 open tabs. No corporate fluff, no sugarcoating—just brutal, constructive sarcasm and direct bullet-by-bullet rewrites to make your resume stand out in the ATS pile.

---

##  Features

* ** Recruiter-Style Roast & Score:** Get a brutal score and unfiltered, sarcastic critique highlighting exactly why your resume gets ignored.
* ** ATS Compatibility Checker:** Identifies formatting traps, weak bullet points, and filler skills.
* ** Before vs. After Rewrites:** Generates direct side-by-side bullet point improvements with measurable impact.
* ** Secure Auth:** Sign up and log in securely via Supabase.
* ** Roast History:** Access and view all your previous resume roasts and scores from your personal dashboard.

---

## Tech Stack

* **Frontend:** React, TypeScript, Tailwind CSS, Lucide Icons, Framer Motion
* **Backend:** Node.js, Express, Multer (for PDF handling)
* **AI Engine:** Google Gemini API (tuned for constructive sarcasm)
* **Database & Storage:** Supabase (Auth, DB Metadata, and Secure PDF Storage)

---

## Getting Started

### 1. Clone the repository
```bash
git clone https://github.com/Yashas8gatty/ResumeRoaster.git
cd ResumeRoaster
```

### 2. Set up the Database (Supabase)

1. Create a new project on [Supabase](https://supabase.com/).
2. Run this query in the **SQL Editor** to create the `roasts` table:
   ```sql
   CREATE TABLE public.roasts (
     id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
     user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
     name        text NOT NULL,
     email       text NOT NULL,
     resume_pdf  text NOT NULL DEFAULT '',
     score       integer NOT NULL,
     created_at  timestamptz DEFAULT now()
   );
   ```
3. Go to **Storage**, create a new **Public Bucket** named `resumes`.

### 3. Configure Environment Variables

Create a `.env` file inside the `server/` directory:
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key

SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_KEY=your_supabase_service_role_key

JWT_SECRET=your_jwt_secret
```

### 4. Install Dependencies & Run

#### Backend:
```bash
cd server
npm install
npm run dev
```

#### Frontend:
```bash
cd client
npm install
npm run dev
```

The frontend will run at `http://localhost:5173/` and the backend at `http://localhost:5000/`.

---

## 📝 License

Distributed under the MIT License. See `LICENSE` for more information.
