import styles from "../styles/captcha.css?inline";

let sheet: CSSStyleSheet | null = null;

function styleSheet(): CSSStyleSheet {
  if (!sheet) {
    sheet = new CSSStyleSheet();
    sheet.replaceSync(styles);
  }
  return sheet;
}

class LunyntCaptcha extends HTMLElement {
  #overlay: HTMLElement;
  #resolve: ((token: string) => void) | null = null;
  #reject: ((error: Error) => void) | null = null;
  #token = "";
  #busy = false;

  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });

    if ("adoptedStyleSheets" in root) {
      root.adoptedStyleSheets = [styleSheet()];
    }

    root.innerHTML = `
      <div class="overlay" part="overlay">
        <div class="card" role="dialog" aria-modal="true" aria-label="human check">
          <p class="title">are you a beep boop?</p>
          <p class="text">quick check before you continue</p>
          <div class="actions">
            <button class="btn" type="button" data-cancel>beep boop</button>
            <button class="btn primary" type="button" data-confirm>no, i'm human</button>
          </div>
        </div>
      </div>`;

    this.#overlay = root.querySelector<HTMLElement>(".overlay")!;
    root
      .querySelector("[data-confirm]")
      ?.addEventListener("click", () => void this.#confirm());
    root
      .querySelector("[data-cancel]")
      ?.addEventListener("click", () => this.#cancel());
    this.#overlay.addEventListener("click", (event) => {
      if (event.target === this.#overlay) {
        this.#cancel();
      }
    });
  }

  ask(): Promise<string> {
    if (this.#token) {
      return Promise.resolve(this.#token);
    }

    this.#overlay.classList.add("is-open");
    return new Promise<string>((resolve, reject) => {
      this.#resolve = resolve;
      this.#reject = reject;
    });
  }

  async #confirm(): Promise<void> {
    if (this.#busy) {
      return;
    }
    this.#busy = true;

    try {
      const response = await fetch("/api/challenge", {
        headers: { accept: "application/json" },
      });
      const data = (await response.json()) as { token?: string };
      if (!response.ok || !data.token) {
        throw new Error("unavailable");
      }
      this.#token = data.token;
      this.#close();
      this.#resolve?.(data.token);
    } catch {
      this.#reject?.(new Error("challenge failed"));
      this.#close();
    } finally {
      this.#busy = false;
      this.#resolve = null;
      this.#reject = null;
    }
  }

  #cancel(): void {
    this.#reject?.(new Error("cancelled"));
    this.#resolve = null;
    this.#reject = null;
    this.#close();
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
