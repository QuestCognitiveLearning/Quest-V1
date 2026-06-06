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
    <View wrap={false} style={{ marginBottom: 14 }}>
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

export default function ClassWorkbook({
  className,
  curriculumName,
  gradeLevel,
  subunits,
  branding,
}) {
  return (
    <Document
      author={branding?.businessName || "Quest Learning"}
      title={`${className} — Class Workbook`}
    >
      <Cover
        eyebrow="Class Workbook"
        title={className}
        subtitle={`${curriculumName || ""} · ${gradeLevel || ""}`.trim()}
        meta={[
          `${subunits.length} subunits`,
          `Generated ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
        ]}
        branding={branding}
      />

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Table of Contents</Text>
        <Text style={styles.h1}>{className}</Text>

        <View style={{ marginTop: 12 }}>
          {subunits.map((s, i) => (
            <View
              key={s.id || i}
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
                  width: 28,
                  fontFamily: "Helvetica-Bold",
                  color: COLORS.brand,
                }}
              >
                {String(i + 1).padStart(2, "0")}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Helvetica-Bold" }}>
                  {s.subunit_name}
                </Text>
                {s.unit_name ? (
                  <Text style={styles.muted}>{s.unit_name}</Text>
                ) : null}
              </View>
              <Text style={styles.muted}>
                {(s.questions?.length || 0)} q ·{" "}
                {s.case_study ? "1 case study" : "—"}
              </Text>
            </View>
          ))}
        </View>

        <Footer branding={branding} />
      </Page>

      {subunits.map((s, si) => (
        <React.Fragment key={s.id || si}>
          <Page size="LETTER" style={styles.page}>
            <Text style={styles.sectionEyebrow}>
              Subunit {si + 1} of {subunits.length}
            </Text>
            <Text style={styles.h1}>{s.subunit_name}</Text>
            {s.unit_name ? (
              <Text style={styles.muted}>{s.unit_name}</Text>
            ) : null}

            {s.questions && s.questions.length > 0 ? (
              <View style={{ marginTop: 16 }}>
                <Text style={styles.h3}>Knowledge check</Text>
                {s.questions.map((q, i) => (
                  <QuestionBlock key={q.id || i} q={q} index={i} />
                ))}
              </View>
            ) : (
              <Text style={[styles.muted, { marginTop: 14 }]}>
                No quiz questions generated for this subunit yet.
              </Text>
            )}

            <Footer branding={branding} />
          </Page>

          {s.case_study ? (
            <Page size="LETTER" style={styles.page}>
              <Text style={styles.sectionEyebrow}>
                Case study — {s.subunit_name}
              </Text>
              <View style={styles.tintBox}>
                <Text style={[styles.body, { lineHeight: 1.55 }]}>
                  {s.case_study.scenario}
                </Text>
              </View>
              {(s.case_study.prompts || []).map((p, i) => (
                <View key={i} style={{ marginBottom: 16 }} wrap={false}>
                  <Text style={styles.question}>
                    <Text style={styles.qNumber}>{i + 1}. </Text>
                    {p}
                  </Text>
                  {Array.from({ length: 4 }).map((_, j) => (
                    <View key={j} style={styles.ruledLine} />
                  ))}
                </View>
              ))}
              <Footer branding={branding} />
            </Page>
          ) : null}
        </React.Fragment>
      ))}
    </Document>
  );
}
