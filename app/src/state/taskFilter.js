import { createStore } from "./createStore";

// Porte 1:1 de "var taskFilter" do HTML original.
export const taskFilterStore = createStore({ status: "todas", urg: "todas", tipo: "todas", tipoAtendimento: "todas", stale: false, q: "" });
