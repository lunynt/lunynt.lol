import styles from "../styles/captcha.css?inline";

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
}

let sheet: CSSStyleSheet | null = null;

function styleSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
  }
  return sheet;
}

let turnstilePromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (turnstilePromise) {
    return turnstilePromise;
  }

  turnstilePromise = new Promise<TurnstileApi>((resolve, reject) => {
    const existing = (window as unknown as { turnstile?: TurnstileApi })
      .turnstile;
    if (existing) {
      resolve(existing);
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", () => {
      const api = (window as unknown as { turnstile?: TurnstileApi }).turnstile;
      if (api) {
        resolve(api);
      } else {
        reject(new Error("turnstile unavailable"));
      }
    });
    script.addEventListener("error", () =>
      reject(new Error("turnstile failed to load")),
    );
    document.head.appendChild(script);
  });

  return turnstilePromise;
}

class LunyntCaptcha extends HTMLElement {
  #overlay: HTMLElement;
  #actions: HTMLElement;
  #widget: HTMLElement;
  #resolve: ((token: string) => void) | null = null;
  #reject: ((error: Error) => void) | null = null;
  #widgetId: string | undefined;
  #busy = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });

    if ("adoptedStyleSheets" in root) {
      root.adoptedStyleSheets = [styleSheet()];
    }

    root.innerHTML = `
      <div class="overlay" part="overlay" tabindex="-1">
        <div class="card" role="dialog" aria-modal="true" aria-label="human check">
          <p class="title">are you a beep boop?</p>
          <p class="text">confirm you are human to continue</p>
          <div class="widget" data-widget hidden></div>
          <div class="actions" data-actions>
            <button class="btn" type="button" data-beep>beep boop</button>
            <button class="btn primary" type="button" data-human>i'm human</button>
          </div>
        </div>
      </div>`;

    this.#overlay = root.querySelector<HTMLElement>(".overlay")!;
    this.#actions = root.querySelector<HTMLElement>("[data-actions]")!;
    this.#widget = root.querySelector<HTMLElement>("[data-widget]")!;

    root
      .querySelector("[data-human]")
      ?.addEventListener("click", () => void this.#human());
    root
      .querySelector("[data-beep]")
      ?.addEventListener("click", () => this.#cancel());
    this.#overlay.addEventListener("click", (event) => {
      if (event.target === this.#overlay) {
        this.#cancel();
      }
    });
    this.#overlay.addEventListener("keydown", (event) => {
      if ((event as KeyboardEvent).key === "Escape") {
        this.#cancel();
      }
    });
  }

  ask(): Promise<string> {
    this.#actions.hidden = false;
    this.#overlay.classList.add("is-open");
    this.#overlay.focus();

    return new Promise<string>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  async #human(): Promise<void> {
    if (this.#busy) {
      return;
    }
    this.#busy = true;

    const siteKey = this.dataset.siteKey ?? "";
    this.#actions.hidden = true;
    this.#widget.hidden = false;

    if (!siteKey) {
      this.#fail();
      return;
    }

    try {
      const api = await loadTurnstile();
      if (this.#widgetId === undefined) {
        this.#widgetId = api.render(this.#widget, {
          sitekey: siteKey,
          theme: "dark",
          appearance: "always",
          size: "flexible",
          callback: (token: string) => this.#succeed(token),
          "error-callback": () => this.#fail(),
        });
      } else {
        api.reset(this.#widgetId);
      }
    } catch {
      this.#fail();
    }
  }

  #succeed(token: string): void {
    const resolve = this.#resolve;
    this.#settle();
    resolve?.(token);
    this.#close();
  }

  #fail(): void {
    const reject = this.#reject;
    this.#settle();
    reject?.(new Error("challenge failed"));
    this.#close();
  }

  #cancel(): void {
    const reject = this.#reject;
    this.#settle();
    reject?.(new Error("cancelled"));
    this.#close();
  }

  #settle(): void {
    this.#busy = false;
    this.#resolve = null;
    this.#reject = null;
    this.#widget.hidden = true;
    this.#actions.hidden = false;
  }

  #close(): void {
    this.#overlay.classList.remove("is-open");
  }
}

if (!customElements.get("lunynt-captcha")) {
  customElements.define("lunynt-captcha", LunyntCaptcha);
}

export function askCaptcha(): Promise<string> {
  const element = document.querySelector("lunynt-captcha") as
    | LunyntCaptcha
    | null;
  return element ? element.ask() : Promise.resolve("");
}

export {};
