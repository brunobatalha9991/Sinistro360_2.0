import { fmtDateBR } from "./format";

// Porte 1:1 de exportCSV() do HTML original — gera e baixa um CSV local dos
// sinistros filtrados (não sai da máquina do usuário, não envia nada a lugar nenhum).
export function exportCSV(rows) {
  const cols = ["numsin", "segurado", "placa", "cia", "ramo", "situacao", "numapo", "datoco", "datavi", "datenc", "valavi", "valind", "franquia", "responsavel", "oficina"];
  const head = cols.join(";");
  const lines = rows.map((c) => cols.map((k) => {
    let v = c[k];
    if (/^dat/.test(k)) v = fmtDateBR(v);
    return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  }).join(";"));
  const blob = new Blob(["﻿" + head + "\n" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sinistros_corp.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
}
