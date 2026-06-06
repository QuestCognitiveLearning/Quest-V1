// On trial start (or any conversion event), pull any prior /try leads
// for this email that have stored quiz payloads but haven't been imported
// yet. Recreate each as Curriculum → Unit → Subunit → Quiz → Questions
// (+ CaseStudy when present) inside the new user's library and mark the
// lead row as converted so we never double-import.
//
// Safe to call repeatedly: the first call processes all pending leads, the
// next call sees zero pending and no-ops. Each lead is processed independently
// so a malformed payload doesn't poison the whole batch.

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type StoredQuiz = {
  question: string;
  choice_a: string;
  choice_b: string;
  choice_c: string;
  choice_d: string;
  correct_choice: string;  // 'A' | 'B' | 'C' | 'D'
  explanation?: string;
};
type StoredCaseStudy = {
  scenario: string;
  discussion_questions: string[];
};
type StoredVideo = {
  title?: string;
  channelTitle?: string;
  url?: string;
};
type StoredPayload = {
  video?: StoredVideo | null;
  quiz?: StoredQuiz[];
  case_study?: StoredCaseStudy | null;
};

const LETTER_TO_NUM: Record<string, number> = { A: 1, B: 2, C: 3, D: 4 };

export async function importLeadsForUser(
  admin: SupabaseClient,
  userId: string,
  email: string,
): Promise<{ imported: number; errors: number }> {
  const normalized = email.trim().toLowerCase();
  const summary = { imported: 0, errors: 0 };

  const { data: pending, error } = await admin
    .from('leads')
    .select('id, generated_quiz_payload, video_title')
    .eq('email', normalized)
    .is('converted_to_user_id', null)
    .not('generated_quiz_payload', 'is', null);
  if (error) {
    console.error('[importLeads] could not query leads:', error);
    return summary;
  }
  if (!pending || pending.length === 0) {
    return summary;
  }

  // Find or create the curriculum + unit that collects imported content.
  let curriculumId: string | null = null;
  const { data: existingCurriculum } = await admin
    .from('curricula')
    .select('id')
    .eq('teacher_id', userId)
    .eq('subject_name', 'From your free generations')
    .maybeSingle();
  if (existingCurriculum?.id) {
    curriculumId = existingCurriculum.id;
  } else {
    const { data: created, error: cErr } = await admin
      .from('curricula')
      .insert({
        teacher_id: userId,
        subject_name: 'From your free generations',
        curriculum_difficulty: 'High',
        color: 'blue',
        created_by_id: userId,
      })
      .select('id')
      .single();
    if (cErr || !created) {
      console.error('[importLeads] could not create curriculum:', cErr);
      summary.errors++;
      return summary;
    }
    curriculumId = created.id;
  }

  let unitId: string | null = null;
  const { data: existingUnit } = await admin
    .from('units')
    .select('id')
    .eq('curriculum_id', curriculumId)
    .eq('unit_name', 'YouTube handouts')
    .maybeSingle();
  if (existingUnit?.id) {
    unitId = existingUnit.id;
  } else {
    const { data: created, error: uErr } = await admin
      .from('units')
      .insert({
        curriculum_id: curriculumId,
        unit_name: 'YouTube handouts',
        unit_order: 1,
        created_by_id: userId,
      })
      .select('id')
      .single();
    if (uErr || !created) {
      console.error('[importLeads] could not create unit:', uErr);
      summary.errors++;
      return summary;
    }
    unitId = created.id;
  }

  let order = 0;
  for (const row of pending) {
    try {
      const payload = row.generated_quiz_payload as StoredPayload | null;
      if (!payload || !Array.isArray(payload.quiz) || payload.quiz.length === 0) {
        await admin
          .from('leads')
          .update({
            converted_to_user_id: userId,
            converted_to_user_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        continue;
      }

      const topic =
        payload.video?.title ||
        row.video_title ||
        `Generated handout ${order + 1}`;
      order++;

      const { data: subunit, error: sErr } = await admin
        .from('subunits')
        .insert({
          unit_id: unitId,
          subunit_name: topic.slice(0, 200),
          subunit_order: order,
          created_by_id: userId,
        })
        .select('id')
        .single();
      if (sErr || !subunit) throw sErr || new Error('subunit insert failed');

      const { data: quiz, error: qErr } = await admin
        .from('quizzes')
        .insert({
          subunit_id: subunit.id,
          quiz_type: 'new_topic',
          created_by_id: userId,
        })
        .select('id')
        .single();
      if (qErr || !quiz) throw qErr || new Error('quiz insert failed');

      const questionRows = payload.quiz.map((q, i) => ({
        quiz_id: quiz.id,
        question_text: q.question,
        choice_1: q.choice_a,
        choice_2: q.choice_b,
        choice_3: q.choice_c,
        choice_4: q.choice_d,
        correct_choice:
          LETTER_TO_NUM[String(q.correct_choice || '').toUpperCase()] || 1,
        question_order: i,
        difficulty: 'medium',
        created_by_id: userId,
      }));
      if (questionRows.length > 0) {
        const { error: queErr } = await admin
          .from('questions')
          .insert(questionRows);
        if (queErr) throw queErr;
      }

      const cs = payload.case_study;
      if (cs?.scenario && Array.isArray(cs.discussion_questions)) {
        const prompts = cs.discussion_questions;
        const { error: csErr } = await admin
          .from('case_studies')
          .insert({
            subunit_id: subunit.id,
            scenario: cs.scenario,
            question_a: prompts[0] || null,
            question_b: prompts[1] || null,
            question_c: prompts[2] || null,
            question_d: prompts[3] || null,
            created_by_id: userId,
          });
        if (csErr) throw csErr;
      }

      await admin
        .from('leads')
        .update({
          converted_to_user_id: userId,
          converted_to_user_at: new Date().toISOString(),
        })
        .eq('id', row.id);

      summary.imported++;
    } catch (err) {
      console.error(`[importLeads] failed for lead ${row.id}:`, err);
      summary.errors++;
    }
  }

  console.log(
    `[importLeads] user=${userId} email=${normalized} imported=${summary.imported} errors=${summary.errors}`,
  );
  return summary;
}
