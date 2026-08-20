import { createStore } from "./createStore";

// Porte 1:1 de "var notifPanelOpen" do HTML original.
export const notifPanelStore = createStore({ open: false });
