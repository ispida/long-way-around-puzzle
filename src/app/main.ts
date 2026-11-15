/** Boot of the public app. */
import "../styles/fonts.css";
import "../styles/tokens.css";
import "../styles/base.css";
import "../styles/game.css";
import type { PageContext } from "@pages/context";
import { createStore } from "@storage/store";
import { selectableThemes, themeLibrary } from "@themes/manifest";
import { loadTheme, type Theme } from "@themes/theme";
import { el, renderShell } from "@ui/layout";
import { introDialog } from "@ui/intro";
import { menuButton } from "@ui/select";
import { text } from "@ui/text";
import { loadGameContent } from "./content";
import { startRouter, type Router } from "./router";

async function boot(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) throw new Error("#app missing");

  const content = loadGameContent();
  const store = createStore();
  store.useCampaign(content.campaign.version);
  for (const [id, tag] of content.ruleTags) store.useRules(id, tag);
  const lib = themeLibrary();
  const themes = selectableThemes(lib);
  const saved = store.theme();
  const themeId = themes.some((t) => t.id === saved) ? (saved as string) : (themes[0]?.id ?? "default");
  const theme = await loadTheme(lib, content.registry, themeId);
  applyThemeColors(theme);
  const ctx: PageContext = {
    ...content,
    store,
    theme,
  };

  const switcher = menuButton(text.theme.label, themes, themeId, (id) => {
    store.setTheme(id);
    void loadTheme(lib, content.registry, id).then((t) => {
      applyThemeColors(t);
      router.setTheme(t);
    });
  });

  const shell = renderShell(
    root,
    [
      { href: "/", label: text.nav.daily },
      { href: "/campaign", label: text.nav.campaign },
      { href: "/rules", label: text.nav.rules },
      { href: "/stats", label: text.nav.stats },
    ],
    [{ href: "/about", label: text.footer.about }],
    headerActions(switcher),
  );
  // The switch's callback only runs after this line, so `router` is always initialised by then.
  const router: Router = startRouter(shell, ctx);

  // First visit: a short "How to play" pop-up, shown once. The flag is set as it opens: the dialog's
  // close event comes a moment after it hides, too late if the player reloads or leaves right away.
  if (!store.introSeen()) {
    store.markIntroSeen();
    const intro = introDialog(theme.text);
    document.body.append(intro);
    intro.showModal();
  }
}

/** Header actions: the bear switch. */
function headerActions(switcher: HTMLElement): HTMLElement {
  const box = el("div", "header-actions");
  box.append(switcher);
  return box;
}

/** The theme's frame colour around boards (its palette's `boardFrame`); the stylesheet's default otherwise. */
function applyThemeColors(theme: Theme): void {
  const frame = theme.palette.boardFrame;
  if (frame) document.documentElement.style.setProperty("--board-frame", frame);
  else document.documentElement.style.removeProperty("--board-frame");
}

void boot();
