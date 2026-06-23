import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../shared/styles.js";
import Cover from "../shared/Cover.jsx";
import Footer from "../shared/Footer.jsx";

const LETTERS = ["A", "B", "C", "D"];

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function QuestionBlock({ q, index }) {
  const choices = [q.choice_1, q.choice_2, q.choice_3, q.choice_4].filter(
    (c) => c != null && c !== ""
  );
  return (
    <View wrap={false} style={{ marginBottom: 18 }}>
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

export default function QuizPacket({
  topic,
  gradeLevel,
  source,
  standards,
  questions,
  estimatedMinutes,
  branding,
  includeAnswerKey = true,
}) {
  const total = questions.length;
  const pages = chunk(questions, 4);

  return (
    <Document
      author={branding?.businessName || "Quest Learning"}
      title={`${topic} — Quiz Packet`}
    >
      <Cover
        eyebrow="Quiz Packet"
        title={topic}
        subtitle={`${total} multiple-choice questions · ${gradeLevel || "All grades"}`}
        meta={[
          source ? `Source: ${source}` : null,
          standards ? `Standards: ${standards}` : null,
          `Estimated time: ${estimatedMinutes || Math.max(10, total * 1.5)} min`,
          `Generated ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
        ]}
        features={[
          `${total} multiple-choice questions with answer key`,
          "Print and hand out, project on a screen, or assign as take-home",
          "Run it live in Quest for instant leaderboards and analytics",
        ]}
        branding={branding}
      />

      {pages.map((pageQs, pi) => (
        <Page key={pi} size="LETTER" style={styles.page}>
          <Text style={styles.sectionEyebrow}>Questions</Text>
          <Text style={styles.h2}>
            {topic}{" "}
            <Text style={{ color: COLORS.ink3, fontFamily: "Helvetica" }}>
              · Page {pi + 1} of {pages.length}
            </Text>
          </Text>

          <View style={{ marginTop: 10 }}>
            {pageQs.map((q, i) => (
              <QuestionBlock key={q.id || i} q={q} index={pi * 4 + i} />
            ))}
          </View>

          <View style={{ marginTop: 12, marginBottom: 6 }}>
            <Text style={styles.muted}>
              Name: ______________________________ Date: __________
            </Text>
          </View>

          <Footer branding={branding} />
        </Page>
      ))}

      {includeAnswerKey ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.sectionEyebrow}>Answer Key</Text>
          <Text style={styles.h1}>{topic} — Answers</Text>

          <View
            style={{
              flexDirection: "row",
              marginTop: 16,
              gap: 24,
            }}
          >
            {[questions.slice(0, Math.ceil(questions.length / 2)), questions.slice(Math.ceil(questions.length / 2))].map(
              (col, ci) => (
                <View key={ci} style={{ flex: 1 }}>
                  {col.map((q, i) => {
                    const idx =
                      ci === 0 ? i : Math.ceil(questions.length / 2) + i;
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
                          {idx + 1}.
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
                </View>
              )
            )}
          </View>

          <Footer branding={branding} />
        </Page>
      ) : null}
    </Document>
  );
}
