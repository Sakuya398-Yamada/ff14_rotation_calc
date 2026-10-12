import type React from "react";

/**
 * 区間エディタ（ボス離脱・複数体・PPS 範囲）の共通スタイル。違いは区間色だけなので、色の CSS 変数名から一式を作る（#395）。
 * @param colorVar 区間色の CSS 変数名（例: "--color-zone-untargetable"）
 */
export function zoneEditorStyles(colorVar: string): Record<
  "editor" | "header" | "title" | "actionButton" | "empty" | "row" | "label" | "input" | "deleteButton",
  React.CSSProperties
> {
  const color = `var(${colorVar})`;
  const tint = (percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;
  return {
    editor: {
      backgroundColor: tint(5),
      border: `1px solid ${tint(20)}`,
      borderRadius: "6px",
      padding: "8px 12px",
      marginBottom: "8px",
    },
    header: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: "6px",
    },
    title: {
      fontSize: "13px",
      fontWeight: "bold",
      color,
    },
    /** 追加（ヘッダー右）・全体（PPS の行内）などの操作ボタン */
    actionButton: {
      background: "none",
      border: `1px solid ${tint(40)}`,
      borderRadius: "4px",
      color,
      fontSize: "12px",
      padding: "2px 10px",
      cursor: "pointer",
    },
    empty: {
      fontSize: "12px",
      color: "var(--color-muted)",
    },
    row: {
      display: "flex",
      alignItems: "center",
      gap: "12px",
      marginBottom: "4px",
    },
    label: {
      fontSize: "12px",
      color: "var(--color-muted)",
      display: "flex",
      alignItems: "center",
      gap: "4px",
    },
    input: {
      width: "60px",
      backgroundColor: "var(--color-raised)",
      border: "1px solid var(--color-field)",
      borderRadius: "4px",
      color: "var(--color-text)",
      padding: "2px 6px",
      fontSize: "12px",
      textAlign: "right",
    },
    deleteButton: {
      background: "none",
      border: `1px solid ${tint(30)}`,
      borderRadius: "4px",
      color,
      fontSize: "12px",
      padding: "2px 8px",
      cursor: "pointer",
      lineHeight: 1,
    },
  };
}
