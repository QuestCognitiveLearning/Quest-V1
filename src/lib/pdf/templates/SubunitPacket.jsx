import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../shared/styles.js";
import Cover from "../shared/Cover.jsx";
import Footer from "../shared/Footer.jsx";

const LETTERS = ["A", "B", "C", "D"];

function QuestionBlock({ q, index }) {
  const choices = [q.choice_1, q.choice_2, q.choice_3, q.choice_4].filter(
    (c) => c != null && c !== ""
  );
  return (
    <View wrap={false} style={{ marginBottom: 16 }}>
      <Text style={styles.question}>
        <Text style={styles.qNumber}>{index + 1}. </Text>
        {q.question_text}
      </Text>
      {choices.map((c, i) => (
        <View key={i} style={styles.choiceRow}>
          <View style={styles.choiceBubble} />
          <Text style={styles.choiceText}>
            <Text style={{ fontFamily: "Helvetica-Bold" }}>{LETTERS[i]}. </Text>
            {c}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function SubunitPacket({
  topic,
  gradeLevel,
  standards,
  questions,
  scenario,
  prompts,
  modelAnswers,
  branding,
}) {
  return (
    <Document
      author={branding?.businessName || "Quest Learning"}
      title={`${topic} — Full Packet`}
    >
      <Cover
        eyebrow="Subunit Packet"
        title={topic}
        subtitle={`Quiz + case study + answer key · ${gradeLevel || "All grades"}`}
        meta={[
          standards ? `Standards: ${standards}` : null,
          `${questions?.length || 0} multiple-choice questions`,
          `${prompts?.length || 0} free-response prompts`,
          `Generated ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
        ]}
        branding={branding}
      />

      {questions && questions.length > 0 ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.sectionEyebrow}>Part 1 — Knowledge check</Text>
          <Text style={styles.h2}>{topic}</Text>
          <Text style={styles.muted}>
            Name: ______________________________ Date: __________
          </Text>
          <View style={{ marginTop: 14 }}>
            {questions.map((q, i) => (
              <QuestionBlock key={q.id || i} q={q} index={i} />
            ))}
          </View>
          <Footer branding={branding} />
        </Page>
      ) : null}

      {scenario ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.sectionEyebrow}>Part 2 — Case study</Text>
          <Text style={styles.h2}>{topic}</Text>

          <View style={styles.tintBox}>
            <Text style={[styles.body, { lineHeight: 1.55 }]}>{scenario}</Text>
          </View>

          {prompts?.map((p, i) => (
            <View key={i} style={{ marginBottom: 16 }} wrap={false}>
              <Text style={styles.question}>
                <Text style={styles.qNumber}>{i + 1}. </Text>
                {p}
              </Text>
              {Array.from({ length: 5 }).map((_, j) => (
                <View key={j} style={styles.ruledLine} />
              ))}
            </View>
          ))}

          <Footer branding={branding} />
        </Page>
      ) : null}

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Answer Key</Text>
        <Text style={styles.h2}>{topic} — Answers</Text>

        {questions && questions.length > 0 ? (
          <>
            <Text style={styles.h3}>Knowledge check</Text>
            {questions.map((q, i) => {
              const correct = LETTERS[(q.correct_choice || 1) - 1];
              return (
                <View key={q.id || i} style={styles.tableRow}>
                  <Text
                    style={{
                      width: 22,
                      fontFamily: "Helvetica-Bold",
                      color: COLORS.brand,
                    }}
                  >
                    {i + 1}.
                  </Text>
                  <Text style={{ width: 22, fontFamily: "Helvetica-Bold" }}>
                    {correct}
                  </Text>
                  <Text style={[styles.body, { flex: 1, fontSize: 10 }]}>
                    {q.explanation || "—"}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}

        {modelAnswers && modelAnswers.length > 0 ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.h3}>Case study — model answers</Text>
            {modelAnswers.map((a, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text
                  style={{
                    fontFamily: "Helvetica-Bold",
                    color: COLORS.brand,
                    marginBottom: 2,
                  }}
                >
                  Prompt {i + 1}
                </Text>
                <Text style={[styles.body, { fontSize: 10 }]}>{a}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Footer branding={branding} />
      </Page>
    </Document>
  );
}
