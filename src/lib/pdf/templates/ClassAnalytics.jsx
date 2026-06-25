import React from "react";
import { Document, Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../shared/styles.js";
import Cover from "../shared/Cover.jsx";
import Footer from "../shared/Footer.jsx";

const pct = (n) => (n == null ? "—" : `${Math.round(n)}%`);
const scoreColor = (n) =>
  n == null ? COLORS.ink3 || "#6B7280" : n >= 70 ? COLORS.green : COLORS.amber;

function StatCard({ label, value, sub }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: COLORS.brandSoft,
        borderRadius: 8,
        padding: 12,
        minHeight: 84,
      }}
    >
      <Text
        style={{
          fontSize: 20,
          fontFamily: "Helvetica-Bold",
          color: COLORS.brandDeep,
          lineHeight: 1.1,
          marginBottom: 6,
        }}
      >
        {value}
      </Text>
      <Text style={{ fontSize: 8.5, color: COLORS.ink2, lineHeight: 1.25 }}>{label}</Text>
      {sub ? (
        <Text style={{ fontSize: 7.5, color: "#6B7280", marginTop: 3, lineHeight: 1.25 }}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function TableHeader({ cols }) {
  return (
    <View
      style={{
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: COLORS.line,
        paddingBottom: 5,
        marginBottom: 2,
      }}
    >
      {cols.map((c, i) => (
        <Text
          key={i}
          style={{
            width: c.w,
            fontSize: 8,
            fontFamily: "Helvetica-Bold",
            color: COLORS.ink2,
            textTransform: "uppercase",
            textAlign: c.align || "left",
          }}
        >
          {c.label}
        </Text>
      ))}
    </View>
  );
}

function Row({ cells }) {
  return (
    <View
      wrap={false}
      style={{
        flexDirection: "row",
        paddingVertical: 5,
        borderBottomWidth: 0.5,
        borderBottomColor: COLORS.line,
        alignItems: "center",
      }}
    >
      {cells.map((c, i) => (
        <Text
          key={i}
          style={{
            width: c.w,
            fontSize: 10,
            color: c.color || COLORS.ink,
            fontFamily: c.bold ? "Helvetica-Bold" : "Helvetica",
            textAlign: c.align || "left",
          }}
        >
          {c.text}
        </Text>
      ))}
    </View>
  );
}

export default function ClassAnalytics({
  className,
  curriculumName,
  gradeLevel,
  studentCount = 0,
  subunitCount = 0,
  classAvg,
  completionPct,
  units = [],
  strugglingSubunits = [],
  students = [],
  branding,
}) {
  return (
    <Document
      author={branding?.businessName || "Quest Learning"}
      title={`${className} — Class Analytics`}
    >
      <Cover
        eyebrow="Class Analytics"
        title={className}
        subtitle={`${curriculumName || ""} · ${gradeLevel || ""}`.replace(/^ · | · $/g, "").trim()}
        meta={[
          `${studentCount} student${studentCount === 1 ? "" : "s"}`,
          `${subunitCount} topics`,
          `Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
        ]}
        branding={branding}
      />

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Overview</Text>
        <Text style={styles.h1}>How the class is doing</Text>

        <View style={{ flexDirection: "row", gap: 8, marginTop: 14, marginBottom: 6 }}>
          <StatCard label="Class average score" value={pct(classAvg)} sub="across completed work" />
          <StatCard label="Avg. completion" value={pct(completionPct)} sub="of assigned topics" />
          <StatCard label="Students" value={String(studentCount)} />
          <StatCard label="Topics" value={String(subunitCount)} />
        </View>

        <Text style={{ ...styles.muted, marginTop: 6, marginBottom: 14 }}>
          Averages are computed from each student&apos;s completed learn and review
          sessions. A topic with no completions yet shows no score.
        </Text>

        <Text style={{ ...styles.sectionEyebrow, marginTop: 4 }}>Performance by unit</Text>
        <View style={{ marginTop: 8 }}>
          <TableHeader
            cols={[
              { label: "Unit", w: "55%" },
              { label: "Avg score", w: "22%", align: "right" },
              { label: "Completion", w: "23%", align: "right" },
            ]}
          />
          {units.length === 0 ? (
            <Text style={{ ...styles.muted, marginTop: 8 }}>No units in this curriculum yet.</Text>
          ) : (
            units.map((u, i) => (
              <Row
                key={i}
                cells={[
                  { text: u.name, w: "55%", bold: true },
                  { text: pct(u.avg), w: "22%", align: "right", color: scoreColor(u.avg), bold: true },
                  { text: pct(u.completionPct), w: "23%", align: "right", color: COLORS.ink2 },
                ]}
              />
            ))
          )}
        </View>

        <Footer branding={branding} />
      </Page>

      <Page size="LETTER" style={styles.page}>
        <Text style={styles.sectionEyebrow}>Where to focus</Text>
        <Text style={styles.h1}>Topics that need attention</Text>
        <Text style={{ ...styles.muted, marginTop: 2, marginBottom: 10 }}>
          Lowest-scoring topics (below 70%) — good candidates for a review session.
        </Text>
        <TableHeader
          cols={[
            { label: "Topic", w: "55%" },
            { label: "Unit", w: "27%" },
            { label: "Avg", w: "18%", align: "right" },
          ]}
        />
        {strugglingSubunits.length === 0 ? (
          <Text style={{ ...styles.muted, marginTop: 8 }}>
            No struggling topics — nice work! (Or not enough completions yet to tell.)
          </Text>
        ) : (
          strugglingSubunits.map((s, i) => (
            <Row
              key={i}
              cells={[
                { text: s.name, w: "55%", bold: true },
                { text: s.unit || "—", w: "27%", color: COLORS.ink2 },
                { text: pct(s.avg), w: "18%", align: "right", color: scoreColor(s.avg), bold: true },
              ]}
            />
          ))
        )}

        <Text style={{ ...styles.sectionEyebrow, marginTop: 22 }}>Students</Text>
        <Text style={styles.h1}>Per-student averages</Text>
        <View style={{ marginTop: 8 }}>
          <TableHeader
            cols={[
              { label: "Student", w: "55%" },
              { label: "Avg score", w: "22%", align: "right" },
              { label: "Completed", w: "23%", align: "right" },
            ]}
          />
          {students.length === 0 ? (
            <Text style={{ ...styles.muted, marginTop: 8 }}>No students enrolled yet.</Text>
          ) : (
            students.map((s, i) => (
              <Row
                key={i}
                cells={[
                  { text: s.name, w: "55%", bold: true },
                  { text: pct(s.avg), w: "22%", align: "right", color: scoreColor(s.avg), bold: true },
                  { text: `${s.completedCount}/${subunitCount}`, w: "23%", align: "right", color: COLORS.ink2 },
                ]}
              />
            ))
          )}
        </View>

        <Footer branding={branding} />
      </Page>
    </Document>
  );
}
