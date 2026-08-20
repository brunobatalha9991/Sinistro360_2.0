import { createStore } from "./createStore";

// Porte 1:1 de "window.demandaFilter" do HTML original.
export const demandaFilterStore = createStore({ status: "todas", origem: "todos", q: "" });
