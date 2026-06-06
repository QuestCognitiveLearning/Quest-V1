import React from "react";
import { Text, View } from "@react-pdf/renderer";
import { COLORS, SIZES } from "./styles.js";

export default function Footer({ branding }) {
  const businessName = branding?.businessName || "questlearning.co";
  return (
    <View
      fixed
      style={{
        position: "absolute",
        bottom: 28,
        left: 54,
        right: 54,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Text style={{ fontSize: SIZES.footer, color: COLORS.ink3 }}>
        {businessName}
      </Text>
      <Text
        style={{ fontSize: SIZES.footer, color: COLORS.ink3 }}
        render={({ pageNumber, totalPages }) =>
          `${pageNumber} / ${totalPages}`
        }
      />
    </View>
  );
}
