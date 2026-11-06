import { describe, expect, it } from "vitest";
import {
  alternateLanguagePath,
  isPrivacyPolicyPath,
  languageBasePath,
  languageFromPath,
  privacyPolicyPath,
} from "../language-path";

describe("languageFromPath", () => {
  it.each(["/en", "/en/", "/en/t/abc", "/en/t/abc/"])("%s は en", (pathname) => {
    expect(languageFromPath(pathname)).toBe("en");
  });

  it.each(["/", "/t/abc", "/enx", "/ent/abc", "/fr/", "/t/en/"])("%s は ja", (pathname) => {
    expect(languageFromPath(pathname)).toBe("ja");
  });
});

describe("languageBasePath", () => {
  it.each([
    ["ja", "/"],
    ["en", "/en/"],
  ] as const)("%s のトップは %s で、languageFromPath で同じ言語に戻る", (lang, path) => {
    expect(languageBasePath(lang)).toBe(path);
    expect(languageFromPath(path)).toBe(lang);
  });
});

describe("alternateLanguagePath", () => {
  it.each([
    ["/", "/en/"],
    ["/en/", "/"],
    ["/en", "/"],
    ["/t/abc", "/en/t/abc"],
    ["/en/t/abc", "/t/abc"],
    ["/privacy", "/en/privacy"],
    ["/en/privacy", "/privacy"],
  ])("%s の別の言語版は %s", (pathname, expected) => {
    expect(alternateLanguagePath(pathname)).toBe(expected);
    expect(languageFromPath(expected)).not.toBe(languageFromPath(pathname));
  });

  it.each(["/", "/en/", "/t/abc", "/en/t/abc"])("%s に 2 回かけると元に戻る", (pathname) => {
    expect(alternateLanguagePath(alternateLanguagePath(pathname))).toBe(pathname);
  });
});

describe("privacyPolicyPath", () => {
  it.each([
    ["ja", "/privacy"],
    ["en", "/en/privacy"],
  ] as const)("%s のプライバシーポリシーは %s で、同じ言語のプライバシーポリシーのパスと判定される", (lang, path) => {
    expect(privacyPolicyPath(lang)).toBe(path);
    expect(languageFromPath(path)).toBe(lang);
    expect(isPrivacyPolicyPath(path)).toBe(true);
  });
});

describe("isPrivacyPolicyPath", () => {
  it.each(["/privacy", "/privacy/", "/en/privacy", "/en/privacy/"])("%s はプライバシーポリシー", (pathname) => {
    expect(isPrivacyPolicyPath(pathname)).toBe(true);
  });

  it.each(["/", "/en/", "/privacyx", "/privacy/x", "/t/privacy", "/en/t/privacy", "/fr/privacy"])(
    "%s はプライバシーポリシーではない",
    (pathname) => {
      expect(isPrivacyPolicyPath(pathname)).toBe(false);
    }
  );
});
