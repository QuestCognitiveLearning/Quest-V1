import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../shared/styles.js";
import Cover from "../shared/Cover.jsx";
import Footer from "../shared/Footer.jsx";

const RULED_LINES = 6;

const RUBRIC = [
  {
    score: 4,
    label: "Exemplary",
    desc: "Insightful analysis, evidence from the scenario, clear reasoning chain.",
  },
  {
    score: 3,
    label: "Proficient",
    desc: "Clear answer with supporting reasoning; minor gaps in evidence use.",
  },
  {
    score: 2,
    label: "Developing",
    desc: "Partial answer or evidence; reasoning is incomplete or unclear.",
  },
  {
    score: 1,
    label: "Emerging",
    desc: "Answer is off-topic, brief, or unsupported.",
  },
];

export default function CaseStudyPacket({
  topic,
  gradeLevel,
  source,
  scenario,
  prompts,
  modelAnswers,
  branding,
}) {
  return (
    <Document
      author={branding?.businessName || "Quest Learning"}
      title={`${topic} — Case Study`}
    >
      <Cover
        eyebrow="Case Study"
        title={topic}
        subtitle={`${prompts.length} free-response prompts · ${gradeLevel || "All grades"}`}
        meta={[
          source ? `Source: ${source}` : null,
          "Estimated time: 25–40 minutes",
          `Generated ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
        ]}
        features={[
          "Real-world scenario in a tinted callout for easy student focus",
          `${prompts.length} free-response prompts with ruled answer space`,
          "4-point rubric and model answers for the teacher",
        ]}
        branding={branding}
      />

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Scenario</Text>
        <Text style={styles.h1}>{topic}</Text>

        <View style={styles.tintBox}>
          <Text style={[styles.body, { lineHeight: 1.55 }]}>{scenario}</Text>
        </View>

        <Text style={styles.muted}>
          Read the scenario above carefully before answering the prompts on the
          following page. You may refer back to it at any time.
        </Text>

        <Footer branding={branding} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Free-Response Prompts</Text>
        <Text style={styles.h2}>{topic} — Your Answers</Text>

        <Text style={styles.muted}>
          Name: ______________________________ Date: __________
        </Text>

        <View style={{ marginTop: 14 }}>
          {prompts.map((p, i) => (
            <View key={i} style={{ marginBottom: 16 }} wrap={false}>
              <Text style={styles.question}>
                <Text style={styles.qNumber}>{i + 1}. </Text>
                {p}
              </Text>
              {Array.from({ length: RULED_LINES }).map((_, j) => (
                <View key={j} style={styles.ruledLine} />
              ))}
            </View>
          ))}
        </View>

        <Footer branding={branding} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Rubric &amp; Model Answers</Text>
        <Text style={styles.h1}>Scoring guide</Text>

        <View style={{ marginTop: 8 }}>
          {RUBRIC.map((r) => (
            <View
              key={r.score}
              style={{
                flexDirection: "row",
                paddingVertical: 8,
                borderBottomWidth: 0.5,
                borderBottomColor: COLORS.line,
                gap: 10,
              }}
            >
              <Text
                style={{
                  width: 24,
                  fontFamily: "Helvetica-Bold",
                  color: COLORS.brand,
                }}
              >
                {r.score}
              </Text>
              <Text
                style={{
                  width: 80,
                  fontFamily: "Helvetica-Bold",
                  color: COLORS.ink,
                }}
              >
                {r.label}
              </Text>
              <Text style={[styles.body, { flex: 1, fontSize: 10 }]}>
                {r.desc}
              </Text>
            </View>
          ))}
        </View>

        {modelAnswers && modelAnswers.length > 0 ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.h3}>Model answers (for teacher use)</Text>
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
