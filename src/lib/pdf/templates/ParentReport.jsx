import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../shared/styles.js";
import Cover from "../shared/Cover.jsx";
import Footer from "../shared/Footer.jsx";

export default function ParentReport({
  studentName,
  dateRangeStart,
  dateRangeEnd,
  topicsCovered,
  accuracySummary,
  strengths,
  areasToPractice,
  tutorNotes,
  questionsForParent,
  branding,
}) {
  const dateLine = `${formatDate(dateRangeStart)} – ${formatDate(dateRangeEnd)}`;

  return (
    <Document
      author={branding?.businessName || "Quest Learning"}
      title={`${studentName} — Progress Report`}
    >
      <Cover
        eyebrow="Progress Report"
        title={studentName}
        subtitle={dateLine}
        meta={[
          branding?.tutorName ? `Prepared by ${branding.tutorName}` : null,
          branding?.businessName || null,
          `Generated ${new Date().toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
        ]}
        branding={branding}
      />

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Summary</Text>
        <Text style={styles.h1}>This week with {studentName}</Text>

        <View
          style={{
            flexDirection: "row",
            gap: 12,
            marginTop: 14,
            marginBottom: 18,
          }}
        >
          <SummaryStat label="Topics covered" value={topicsCovered?.length || 0} />
          <SummaryStat
            label="Accuracy"
            value={
              accuracySummary?.accuracyPct != null
                ? `${Math.round(accuracySummary.accuracyPct)}%`
                : "—"
            }
          />
          <SummaryStat
            label="Time on task"
            value={
              accuracySummary?.timeOnTaskMin
                ? `${accuracySummary.timeOnTaskMin} min`
                : "—"
            }
          />
        </View>

        {topicsCovered && topicsCovered.length > 0 ? (
          <>
            <Text style={styles.h3}>Topics covered</Text>
            <View style={{ marginBottom: 14 }}>
              {topicsCovered.map((t, i) => (
                <Text key={i} style={[styles.body, { marginBottom: 3 }]}>
                  • {t}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        <Text style={styles.h3}>Strengths</Text>
        <Text style={[styles.body, { marginBottom: 14 }]}>
          {strengths || "No notes recorded this period."}
        </Text>

        <Text style={styles.h3}>Areas to practice</Text>
        <Text style={[styles.body, { marginBottom: 14 }]}>
          {areasToPractice || "No notes recorded this period."}
        </Text>

        <Footer branding={branding} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        {tutorNotes ? (
          <>
            <Text style={styles.sectionEyebrow}>
              Notes from {branding?.tutorName || "your tutor"}
            </Text>
            <View style={styles.tintBox}>
              <Text style={[styles.body, { lineHeight: 1.55 }]}>{tutorNotes}</Text>
            </View>
          </>
        ) : null}

        <Text style={styles.sectionEyebrow}>For parents</Text>
        <Text style={styles.h2}>3 questions to ask {studentName} this week</Text>

        {(questionsForParent || []).map((q, i) => (
          <View
            key={i}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                width: 22,
                fontFamily: "Helvetica-Bold",
                color: COLORS.brand,
              }}
            >
              {i + 1}.
            </Text>
            <Text style={[styles.body, { flex: 1, lineHeight: 1.5 }]}>{q}</Text>
          </View>
        ))}

        <View style={styles.divider} />
        <Text style={styles.muted}>
          Questions or to schedule next session, reply to the email this report
          arrived in or contact{" "}
          {branding?.tutorName || branding?.businessName || "your tutor"}.
        </Text>

        <Footer branding={branding} />
      </Page>
    </Document>
  );
}

function SummaryStat({ label, value }) {
  return (
    <View
      style={{
        flex: 1,
        borderRadius: 8,
        backgroundColor: COLORS.brandSoft,
        padding: 12,
      }}
    >
      <Text style={styles.badge}>{label}</Text>
      <Text
        style={{
          fontFamily: "Helvetica-Bold",
          fontSize: 22,
          color: COLORS.ink,
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
}
