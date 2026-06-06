import React from "react";
import { Text, View, Page } from "@react-pdf/renderer";
import { COLORS, styles } from "./styles.js";
import Branding from "./Branding.jsx";
import Footer from "./Footer.jsx";

export default function Cover({
  eyebrow,
  title,
  subtitle,
  meta,
  branding,
  features,
}) {
  const accent = branding?.accentColor || COLORS.brand;
  const metaLines = Array.isArray(meta) ? meta.filter(Boolean) : [];

  return (
    <Page size="LETTER" style={styles.coverPage}>
      <Branding branding={branding} accent={accent} />

      {eyebrow ? (
        <Text style={[styles.coverEyebrow, { color: accent }]}>{eyebrow}</Text>
      ) : null}

      <Text style={styles.coverTitle}>{title}</Text>

      {subtitle ? <Text style={styles.coverSubtitle}>{subtitle}</Text> : null}

      {metaLines.length > 0 ? (
        <View
          style={{
            marginTop: 8,
            paddingTop: 14,
            borderTopWidth: 0.5,
            borderTopColor: COLORS.line,
            gap: 4,
          }}
        >
          {metaLines.map((line, i) => (
            <Text key={i} style={styles.coverMeta}>
              {line}
            </Text>
          ))}
        </View>
      ) : null}

      {Array.isArray(features) && features.length > 0 ? (
        <View
          style={{
            marginTop: 32,
            padding: 22,
            backgroundColor: COLORS.brandSoft,
            borderRadius: 12,
            gap: 8,
          }}
        >
          <Text
            style={{
              fontSize: 10,
              letterSpacing: 1.6,
              color: accent,
              fontFamily: "Helvetica-Bold",
              textTransform: "uppercase",
            }}
          >
            What&apos;s inside
          </Text>
          {features.map((f, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
              }}
            >
              <Text
                style={{
                  color: accent,
                  fontFamily: "Helvetica-Bold",
                  fontSize: 11,
                  marginTop: 1,
                }}
              >
                ·
              </Text>
              <Text
                style={{
                  fontSize: 11,
                  color: COLORS.ink,
                  lineHeight: 1.45,
                  flex: 1,
                }}
              >
                {f}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <Footer branding={branding} />
    </Page>
  );
}
