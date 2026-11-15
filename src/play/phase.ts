/**
 * Play screen state machine: placing → walking → result. From the result the
 * player can submit again right away, or edit the board, which returns to placing.
 */
export type Phase = "placing" | "walking" | "result";
export type PhaseEvent = "submit" | "walked" | "playAgain" | "edit";

export function nextPhase(phase: Phase, event: PhaseEvent, routeOpen = true): Phase {
  if ((phase === "placing" || phase === "result") && event === "submit") return routeOpen ? "walking" : phase;
  if (phase === "walking" && event === "walked") return "result";
  if (phase === "result" && (event === "playAgain" || event === "edit")) return "placing";
  return phase;
}
