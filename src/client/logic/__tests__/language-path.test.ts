import { describe, expect, it } from "vitest";
import { alternateLanguagePath, languageBasePath, languageFromPath } from "../language-path";

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
  ])("%s の別の言語版は %s", (pathname, expected) => {
    expect(alternateLanguagePath(pathname)).toBe(expected);
    expect(languageFromPath(expected)).not.toBe(languageFromPath(pathname));
  });

  it.each(["/", "/en/", "/t/abc", "/en/t/abc"])("%s に 2 回かけると元に戻る", (pathname) => {
    expect(alternateLanguagePath(alternateLanguagePath(pathname))).toBe(pathname);
  });
});
