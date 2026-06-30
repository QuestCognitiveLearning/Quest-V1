/**
 * Samuel.jsx — a standalone personal site for Samuel Michael, served at
 * /samuel. Intentionally NOT linked anywhere in the app and registered as a
 * PUBLIC page (no auth, no app chrome) so it works as a shareable bio link.
 */
import React, { useEffect } from "react";
import {
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  GraduationCap,
  FlaskConical,
  Rocket,
  Mic,
  Landmark,
  Award,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

const STATS = [
  { value: "35", label: "ACT Composite" },
  { value: "4.0 / 4.69", label: "GPA (unweighted / weighted)" },
  { value: "13 AP · 6 DE", label: "Advanced coursework" },
  { value: "<1%", label: "Cornelius Vanderbilt Scholar" },
];

const EXPERIENCE = [
  {
    icon: Rocket,
    color: "text-indigo-600 bg-indigo-50",
    role: "Co-Founder",
    org: "Quest Learning",
    period: "Aug 2024 — Present",
    points: [
      "Built an AI learning platform grounded in cognitive science (spaced repetition, cognitive load theory, inquiry-based learning) that turns any video or document into a full adaptive course in minutes.",
      "In talks with Williamson County Schools to deploy district-wide — a potential 30,000+ students.",
      "Produced 100+ resources, including biology videos that reached 110,000+ views.",
      "Won $2,700 in preseed funding from the EIC Final Pitch; led a 15-member team across curriculum and growth.",
    ],
  },
  {
    icon: FlaskConical,
    color: "text-emerald-600 bg-emerald-50",
    role: "Research Intern — Dr. Charles Flynn Lab",
    org: "Vanderbilt University Medical Center",
    period: "Jul 2025 — Present",
    points: [
      "Investigated liver fibrosis treatment (2-HOBA) and muscle growth (HMB) under an Associate Professor at Vanderbilt University School of Medicine.",
      "Performed immunohistochemical staining, RNA purification, and in vivo mouse drug testing.",
      "Supported lab operations through specimen organization, inventory, and protocol documentation.",
    ],
  },
  {
    icon: Mic,
    color: "text-violet-600 bg-violet-50",
    role: "Co-Founder & Co-Host",
    org: "Teen Talk Christian Podcast",
    period: "Apr 2024 — Present",
    points: [
      "Hosted 25+ episodes on faith issues facing teens, airing twice weekly via CSAT, an Egyptian media company with 500k followers.",
      "Grew to 500,000+ views and 2,000+ followers across platforms; trained a team of 17 volunteers.",
    ],
  },
];

const LEADERSHIP = [
  {
    role: "Director",
    org: "Wealth Education Initiative (Non-Profit)",
    detail:
      "Sits on the Williamson County 5-Year Strategic Plan Committee shaping student personal-finance standards (20,000+ students over 4 years); authored an ebook sent to 200+ students and launched two county financial-literacy chapters.",
  },
  {
    role: "Lieutenant Governor / Speaker of the Senate",
    org: "Tennessee American Legion Boys State",
    detail:
      "Elected (0.14% selection) to preside over the inauguration ceremony before 750+ delegates, including the Tennessee Governor.",
  },
  {
    role: "Founder & President",
    org: "Ravenwood Orthodox Christian School Ministries",
    detail:
      "Grew a faith-based club to 50+ members, organized 25+ events and 100+ volunteer hours, and led a 5-person officer team.",
  },
  {
    role: "Vice President",
    org: "Mu Alpha Theta Math Honor Society",
    detail:
      "Ran monthly meetings for 120+ members, oversaw 750+ volunteer hours, and organized weekly tutoring and middle-school math nights.",
  },
  {
    role: "Educator & Deacon Reader",
    org: "St. Barbara — Coptic Orthodox Church",
    detail:
      "Teaches 4 weekly classes on hymnology and dogma to 150+ children; 500+ service hours and ordained to the rank of Reader.",
  },
  {
    role: "General Officer",
    org: "BioMedical Sciences",
    detail:
      "Mastered 20+ lab skills from PCR amplification to DNA gel genotyping; selected as 1 of 7 to present research to the Tennessee Legislature.",
  },
];

const AWARDS = [
  "TSA National — 6th, Data Science & Analytics (<2%); Biotech Design Semifinalist (<4%); 1st TN State",
  "DECA — Top 91.8 percentile at ICDC (Financial Literacy); 2× 1st place TN State",
  "Model UN — Summit Award for Diplomacy (<0.2%); 2× Outstanding Delegate; Outstanding Resolution",
  "National Merit Commended Scholar (<4%)",
  "6× Outstanding Student (AP/Honors) · 3× Principal's List",
  "HOSA — 3rd, Public Service Announcements; ILC qualifier",
  "Mahragan El-Keraza — 2× 1st, Nashville Religious Research Competition",
];

const PROJECTS = [
  {
    name: "St. Barbara Documentary",
    detail:
      "Wrote, filmed, and directed a 25-minute documentary on a new church's founding; premiered to 350+ members and regional clergy.",
  },
  {
    name: "Global Coptic Day",
    detail:
      "Co-organized a Coptic Orthodox festival for 200+ attendees and delivered 3 presentations on faith, hymnology, and heritage.",
  },
  {
    name: "Flipped-Learning Research Paper",
    detail:
      "Authored a correlational study on the impact of independent work in flipped learning on 15–16-year-olds' math assessment performance.",
  },
  {
    name: "BioMedical Portfolio",
    detail:
      "A three-year documentation portfolio of 20+ projects, from pipetting technique to a structural analysis of a lung dissection.",
  },
];

function SectionTitle({ icon: Icon, children }) {
  return (
    <div className="flex items-center gap-2.5 mb-6">
      {Icon && <Icon className="w-5 h-5 text-indigo-600" />}
      <h2 className="text-xl font-bold tracking-tight text-slate-900">{children}</h2>
      <div className="flex-1 h-px bg-slate-200 ml-2" />
    </div>
  );
}

export default function Samuel() {
  useEffect(() => {
    const prev = document.title;
    document.title = "Samuel Michael";
    return () => {
      document.title = prev;
    };
  }, []);

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-800"
      style={{ fontFamily: '"Inter", system-ui, sans-serif' }}
    >
      {/* Hero */}
      <header className="relative overflow-hidden bg-slate-900 text-white">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background:
              "radial-gradient(60% 80% at 20% 0%, #4f46e5 0%, transparent 60%), radial-gradient(50% 70% at 90% 20%, #7c3aed 0%, transparent 55%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-6 pt-20 pb-14">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-300 mb-5">
            <Sparkles className="w-3.5 h-3.5" /> Builder · Researcher · Student
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight leading-[1.05]">
            Samuel Michael
          </h1>
          <p className="mt-4 text-lg text-slate-300 leading-relaxed max-w-2xl">
            Cornelius Vanderbilt Scholar and co-founder of{" "}
            <a
              href="https://www.questlearning.co"
              className="text-white font-semibold underline decoration-indigo-400/60 underline-offset-4 hover:decoration-indigo-300"
            >
              Quest Learning
            </a>
            . I build at the intersection of medicine, technology, and education —
            from biomedical research at Vanderbilt to an AI platform reaching tens
            of thousands of students.
          </p>

          <div className="mt-7 flex flex-wrap gap-2.5 text-sm">
            <a
              href="mailto:samuelmic207@gmail.com"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-2 backdrop-blur"
            >
              <Mail className="w-4 h-4" /> samuelmic207@gmail.com
            </a>
            <a
              href="tel:+16159577126"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-2 backdrop-blur"
            >
              <Phone className="w-4 h-4" /> (615) 957-7126
            </a>
            <span className="inline-flex items-center gap-2 bg-white/10 rounded-full px-4 py-2 backdrop-blur">
              <MapPin className="w-4 h-4" /> Brentwood, TN
            </span>
            <a
              href="https://www.linkedin.com/in/samuel-michael-979a28397"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full px-4 py-2 backdrop-blur"
            >
              LinkedIn <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </header>

      {/* Stats strip */}
      <div className="max-w-3xl mx-auto px-6 -mt-8 relative z-10">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map((s) => (
            <div
              key={s.label}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 text-center"
            >
              <div className="text-xl font-extrabold text-slate-900">{s.value}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-1 leading-tight">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-6 py-14 space-y-14">
        {/* About */}
        <section>
          <SectionTitle icon={Sparkles}>About</SectionTitle>
          <p className="text-[15px] leading-relaxed text-slate-700">
            I'm an aspiring physician-builder passionate about bridging science,
            technology, and faith. On any given day you'll find me shipping
            features for a learning platform headed to school districts, running
            assays in a Vanderbilt research lab, or recording a podcast that
            reaches communities across two continents. At Vanderbilt I'm pursuing
            Molecular &amp; Cellular Biology and Medicine, Health &amp; Society
            with a minor in Data Science — chasing the intersection of medicine
            and technology.
          </p>
        </section>

        {/* Experience */}
        <section>
          <SectionTitle icon={Rocket}>Experience</SectionTitle>
          <div className="space-y-4">
            {EXPERIENCE.map((e) => (
              <div
                key={e.org}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${e.color}`}>
                    <e.icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <h3 className="font-bold text-slate-900">{e.role}</h3>
                      <span className="text-xs font-medium text-slate-400">{e.period}</span>
                    </div>
                    <p className="text-sm font-semibold text-indigo-600">{e.org}</p>
                    <ul className="mt-3 space-y-1.5">
                      {e.points.map((p, i) => (
                        <li key={i} className="text-sm text-slate-600 leading-relaxed flex gap-2">
                          <span className="mt-2 w-1 h-1 rounded-full bg-slate-300 shrink-0" />
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Leadership */}
        <section>
          <SectionTitle icon={Landmark}>Leadership &amp; Service</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {LEADERSHIP.map((l) => (
              <div
                key={l.org}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
              >
                <h3 className="font-bold text-slate-900 text-sm">{l.role}</h3>
                <p className="text-xs font-semibold text-indigo-600 mb-2">{l.org}</p>
                <p className="text-[13px] text-slate-600 leading-relaxed">{l.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Awards */}
        <section>
          <SectionTitle icon={Award}>Honors &amp; Awards</SectionTitle>
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <ul className="space-y-2.5">
              {AWARDS.map((a, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-700 leading-relaxed">
                  <Award className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Projects */}
        <section>
          <SectionTitle icon={Sparkles}>Selected Projects</SectionTitle>
          <div className="grid sm:grid-cols-2 gap-3">
            {PROJECTS.map((p) => (
              <div
                key={p.name}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
              >
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">{p.name}</h3>
                <p className="text-[13px] text-slate-600 leading-relaxed">{p.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Education */}
        <section>
          <SectionTitle icon={GraduationCap}>Education</SectionTitle>
          <div className="space-y-3">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-bold text-slate-900">Vanderbilt University</h3>
                <span className="text-xs font-medium text-slate-400">Class of 2030</span>
              </div>
              <p className="text-sm font-semibold text-indigo-600">B.S. — Cornelius Vanderbilt Scholar (full tuition, &lt;1%)</p>
              <p className="text-sm text-slate-600 mt-2">
                Double major in Molecular &amp; Cellular Biology and Medicine,
                Health &amp; Society · Minor in Data Science.
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <h3 className="font-bold text-slate-900">Ravenwood High School</h3>
                <span className="text-xs font-medium text-slate-400">Aug 2022 — May 2026</span>
              </div>
              <p className="text-sm text-slate-600 mt-2">
                4.0 unweighted / 4.69 weighted GPA · 35 ACT · 13 AP and 6 dual-enrollment
                courses (incl. Calculus III, Linear Algebra, AP Research).
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500">
          <span>© {2026} Samuel Michael</span>
          <div className="flex items-center gap-4">
            <a href="mailto:samuelmic207@gmail.com" className="hover:text-slate-900 inline-flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> Email
            </a>
            <a
              href="https://www.questlearning.co"
              className="hover:text-slate-900 inline-flex items-center gap-1.5"
            >
              Quest Learning <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
