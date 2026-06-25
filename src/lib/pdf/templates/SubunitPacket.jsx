import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../shared/styles.js";
import Cover from "../shared/Cover.jsx";
import Footer from "../shared/Footer.jsx";

// Rebuilt to use ONLY the primitives/styles proven to render in the browser by
// ClassAnalytics (flat Views, single Text nodes, border-BOTTOM lines, fill
// boxes). The previous version used nested <Text>, a rounded-border bubble, and
// fixed-height ruled Views — one of which makes @react-pdf's browser renderer
// throw "unsupported number" (Node tolerates it, so it can't be reproduced
// headlessly). Keeping the vocabulary identical to the working template avoids
// the crash entirely.

const LETTERS = ["A", "B", "C", "D"];
const num = { width: 20, fontFamily: "Helvetica-Bold", color: COLORS.brand, fontSize: 12 };
const stem = { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 12, lineHeight: 1.35 };

function QuestionBlock({ q, index }) {
  const choices = [q.choice_1, q.choice_2, q.choice_3, q.choice_4].filter(
    (c) => c != null && c !== ""
  );
  return (
    <View wrap={false} style={{ marginBottom: 16 }}>
      <View style={{ flexDirection: "row" }}>
        <Text style={num}>{index + 1}.</Text>
        <Text style={stem}>{q.question_text}</Text>
      </View>
      {choices.map((c, i) => (
        <View key={i} style={{ flexDirection: "row", marginTop: 5, marginLeft: 20, alignItems: "flex-start" }}>
          <View
            style={{ width: 10, height: 10, borderWidth: 1, borderColor: COLORS.ink3, marginTop: 2, marginRight: 8 }}
          />
          <Text style={{ width: 16, fontFamily: "Helvetica-Bold", fontSize: 11 }}>{LETTERS[i]}.</Text>
          <Text style={{ flex: 1, fontSize: 11, lineHeight: 1.35 }}>{c}</Text>
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
  const qs = Array.isArray(questions) ? questions : [];
  const pr = Array.isArray(prompts) ? prompts : [];
  const ma = Array.isArray(modelAnswers) ? modelAnswers : [];

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
          `${qs.length} multiple-choice questions`,
          `${pr.length} free-response prompts`,
          `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        ]}
        features={[
          `${qs.length} multiple-choice knowledge check questions`,
          scenario
            ? `${pr.length} free-response prompts grounded in a real-world scenario`
            : "Free-response prompts (case study)",
          "Answer key + model answers in the back",
        ]}
        branding={branding}
      />

      {qs.length > 0 ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.sectionEyebrow}>Part 1 — Knowledge check</Text>
          <Text style={styles.h1}>{topic}</Text>
          <Text style={styles.muted}>Name: ______________________________   Date: __________</Text>
          <View style={{ marginTop: 14 }}>
            {qs.map((q, i) => (
              <QuestionBlock key={q.id || i} q={q} index={i} />
            ))}
          </View>
          <Footer branding={branding} />
        </Page>
      ) : null}

      {scenario ? (
        <Page size="LETTER" style={styles.page}>
          <Text style={styles.sectionEyebrow}>Part 2 — Case study</Text>
          <Text style={styles.h1}>{topic}</Text>

          <View
            style={{ backgroundColor: COLORS.brandSoft, borderRadius: 6, padding: 14, marginTop: 8, marginBottom: 16 }}
          >
            <Text style={{ fontSize: 11, lineHeight: 1.5 }}>{scenario}</Text>
          </View>

          {pr.map((p, i) => (
            <View key={i} style={{ marginBottom: 16 }} wrap={false}>
              <View style={{ flexDirection: "row", marginBottom: 8 }}>
                <Text style={num}>{i + 1}.</Text>
                <Text style={stem}>{p}</Text>
              </View>
              {[0, 1, 2, 3].map((j) => (
                <View key={j} style={{ borderBottomWidth: 0.5, borderBottomColor: COLORS.line, height: 20 }} />
              ))}
            </View>
          ))}

          <Footer branding={branding} />
        </Page>
      ) : null}

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Answer Key</Text>
        <Text style={styles.h1}>{topic} — Answers</Text>

        {qs.length > 0 ? (
          <View style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 6 }}>Knowledge check</Text>
            {qs.map((q, i) => (
              <View
                key={q.id || i}
                style={{ flexDirection: "row", paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: COLORS.line }}
              >
                <Text style={{ width: 22, fontFamily: "Helvetica-Bold", color: COLORS.brand }}>{i + 1}.</Text>
                <Text style={{ width: 22, fontFamily: "Helvetica-Bold" }}>{LETTERS[(q.correct_choice || 1) - 1]}</Text>
                <Text style={{ flex: 1, fontSize: 10, lineHeight: 1.4 }}>{q.explanation || "—"}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {ma.length > 0 ? (
          <View>
            <View style={{ borderBottomWidth: 0.5, borderBottomColor: COLORS.line, marginVertical: 12 }} />
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", marginTop: 8, marginBottom: 6 }}>Case study — model answers</Text>
            {ma.map((a, i) => (
              <View key={i} style={{ marginBottom: 10 }}>
                <Text style={{ fontFamily: "Helvetica-Bold", color: COLORS.brand, marginBottom: 2 }}>
                  Prompt {i + 1}
                </Text>
                <Text style={{ fontSize: 10, lineHeight: 1.5 }}>{a}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Footer branding={branding} />
      </Page>
    </Document>
  );
}
