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
}) {
  const accent = branding?.accentColor || COLORS.brand;
  return (
    <Page size="LETTER" style={styles.coverPage}>
      <Branding branding={branding} accent={accent} />

      {eyebrow ? (
        <Text style={[styles.coverEyebrow, { color: accent }]}>{eyebrow}</Text>
      ) : null}

      <Text style={styles.coverTitle}>{title}</Text>

      {subtitle ? <Text style={styles.coverSubtitle}>{subtitle}</Text> : null}

      <View style={{ marginTop: 280 }}>
        {Array.isArray(meta)
          ? meta.filter(Boolean).map((line, i) => (
              <Text key={i} style={styles.coverMeta}>
                {line}
              </Text>
            ))
          : null}
      </View>

      <Footer branding={branding} />
    </Page>
  );
}
