"""
Headless-browser reproduction of the STORE hydration bug - deep forensics mode.

Loads a URL in clean Chromium (no extensions), then:
  1. captures the exact content-security-policy header of the MAIN document
     response (paired byte-for-byte with the body the browser parsed),
  2. collects every console message / page error,
  3. after load, lists EVERY <script> element in the DOM with a sha256 of its
     text content, so blocked scripts can be identified against the header,
  4. checks whether TanStack's window.$_TSR dehydrated router initialized.

Usage:
  python repro-console.py <url> [--unregister-sw]
"""

import sys

from playwright.sync_api import sync_playwright


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    url = args[0] if args else "https://store-tau-mocha.vercel.app/"
    unregister_sw = "--unregister-sw" in sys.argv

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        if unregister_sw:
            context.add_init_script(
                "navigator.serviceWorker.getRegistrations()"
                ".then(rs => rs.forEach(r => r.unregister()));"
            )
        page = context.new_page()

        logs: list[str] = []
        page.on("console", lambda m: logs.append(f"[console.{m.type}] ({m.location.get('url','')}) {m.text[:400]}"))
        page.on("pageerror", lambda e: logs.append(f"[PAGEERROR] {str(e)[:400]}"))

        csp_holder: dict[str, str] = {}

        def on_response(response):
            if response.request.resource_type == "document" and not csp_holder:
                csp = response.headers.get("content-security-policy", "(none)")
                csp_holder["csp"] = csp
                print(f"MAIN RESPONSE: {response.status} {response.url}")
                print(f"CSP HEADER AS RECEIVED BY BROWSER:\n{csp}\n")

        page.on("response", on_response)

        page.goto(url, wait_until="networkidle", timeout=45_000)
        page.wait_for_timeout(2_000)

        tsr = page.evaluate(
            "() => typeof window.$_TSR !== 'undefined'"
            " ? { present: true, router: !!window.$_TSR.router }"
            " : { present: false, router: false }"
        )
        inventory = page.evaluate(
            """async () => {
                const out = [];
                for (const s of document.querySelectorAll('script')) {
                    const txt = s.textContent || '';
                    let hash = '(external)';
                    if (txt.trim()) {
                        const d = await crypto.subtle.digest(
                            'SHA-256', new TextEncoder().encode(txt));
                        hash = 'sha256-' +
                            btoa(String.fromCharCode(...new Uint8Array(d)));
                    }
                    out.push({
                        id: s.id || '-',
                        cls: s.className || '-',
                        src: s.src || '(inline)',
                        hash,
                        preview: txt.trim().replace(/\\s+/g, ' ').slice(0, 160),
                    });
                }
                return out;
            }"""
        )

        print("\n--- SCRIPT ELEMENTS IN FINAL DOM ---")
        header = csp_holder.get("csp", "")
        for i, s in enumerate(inventory):
            marker = ""
            if s["hash"].startswith("sha256-"):
                marker = (
                    "  <- IN HEADER" if f"'{s['hash']}'" in header
                    else "  <- *** NOT IN HEADER (this one got blocked) ***"
                )
            print(f"[{i}] id={s['id']} class={s['cls']}")
            print(f"    src={s['src']}")
            if s["hash"] != "(external)":
                print(f"    hash={s['hash']}{marker}")
            print(f"    text: {s['preview']}")

        print("\n--- console output ---")
        for line in logs:
            print(line)

        verdict = (
            "HYDRATION OK"
            if tsr["present"] and tsr["router"]
            else "HYDRATION BROKEN ($_TSR missing/incomplete)"
        )
        print(f"\n--- VERDICT: {verdict} ---")

        browser.close()


if __name__ == "__main__":
    main()
