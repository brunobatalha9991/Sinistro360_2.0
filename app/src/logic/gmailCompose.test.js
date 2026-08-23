import { describe, it, expect } from "vitest";
import { buildRawMessage } from "./gmailCompose";

function decode(rawBase64Url) {
  const norm = rawBase64Url.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8").decode(bytes);
}

describe("buildRawMessage", () => {
  it("monta os headers e o corpo, decodificável de volta", () => {
    const raw = buildRawMessage({ to: "cliente@teste.com", cc: "copia@teste.com", subject: "Assunto", body: "Corpo da mensagem" });
    const texto = decode(raw);
    expect(texto).toContain("To: cliente@teste.com");
    expect(texto).toContain("Cc: copia@teste.com");
    expect(texto).toContain("Corpo da mensagem");
    expect(texto).toContain("Content-Type: text/plain");
  });
  it("sem Cc, não inclui o header", () => {
    const raw = buildRawMessage({ to: "cliente@teste.com", subject: "Assunto", body: "Corpo" });
    expect(decode(raw)).not.toContain("Cc:");
  });
  it("assunto com acento vira encoded-word MIME", () => {
    const raw = buildRawMessage({ to: "a@b.com", subject: "Atualização", body: "x" });
    expect(decode(raw)).toMatch(/Subject: =\?UTF-8\?B\?/);
  });
  it("inclui In-Reply-To/References quando informados (resposta em thread)", () => {
    const raw = buildRawMessage({ to: "a@b.com", subject: "Re: x", body: "y", inReplyTo: "<msg123@mail.gmail.com>", references: "<msg123@mail.gmail.com>" });
    const texto = decode(raw);
    expect(texto).toContain("In-Reply-To: <msg123@mail.gmail.com>");
    expect(texto).toContain("References: <msg123@mail.gmail.com>");
  });
});
