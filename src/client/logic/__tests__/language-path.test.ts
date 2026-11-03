import { describe, expect, it } from "vitest";
import { languageBasePath, languageFromPath } from "../language-path";

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
