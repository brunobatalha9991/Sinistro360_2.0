import { describe, it, expect } from "vitest";
import { decodeBase64Url, extractText, headerValue } from "./gmailApi";

function toBase64Url(s) {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

describe("decodeBase64Url", () => {
  it("decodifica texto simples", () => {
    expect(decodeBase64Url(toBase64Url("Olá, sinistro 2026.001234"))).toBe("Olá, sinistro 2026.001234");
  });
  it("string vazia/indefinida não quebra", () => {
    expect(decodeBase64Url("")).toBe("");
    expect(decodeBase64Url(undefined)).toBe("");
  });
});

describe("headerValue", () => {
  const headers = [{ name: "Subject", value: "Atualização do sinistro" }, { name: "From", value: "Cliente <cliente@teste.com>" }];
  it("acha o header ignorando maiúsculas/minúsculas", () => {
    expect(headerValue(headers, "subject")).toBe("Atualização do sinistro");
    expect(headerValue(headers, "FROM")).toBe("Cliente <cliente@teste.com>");
  });
  it("header ausente devolve string vazia", () => {
    expect(headerValue(headers, "To")).toBe("");
  });
});

describe("extractText", () => {
  it("extrai texto de payload simples (sem partes)", () => {
    const payload = { body: { data: toBase64Url("Corpo direto do e-mail") } };
    expect(extractText(payload)).toBe("Corpo direto do e-mail");
  });
  it("prefere a parte text/plain quando há multipart", () => {
    const payload = {
      parts: [
        { mimeType: "text/html", body: { data: toBase64Url("<p>Html</p>") } },
        { mimeType: "text/plain", body: { data: toBase64Url("Texto puro") } },
      ],
    };
    expect(extractText(payload)).toBe("Texto puro");
  });
  it("cai pro html (sem as tags) se não houver text/plain", () => {
    const payload = { parts: [{ mimeType: "text/html", body: { data: toBase64Url("<p>Só Html</p>") } }] };
    expect(extractText(payload)).toContain("Só Html");
  });
  it("payload nulo não quebra", () => {
    expect(extractText(null)).toBe("");
  });
});
