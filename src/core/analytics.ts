// Anonymous, cookieless usage counts via GoatCounter (script tag in index.html).
// Everything here is fire-and-forget: if the script is blocked or the device is
// offline, nothing is sent and the app carries on.

type GoatCounter = { count?: (vars: { path: string; title?: string; event?: boolean }) => void };

/** Count one "game opened" event. */
export function trackGame(id: string) {
  const send = () => {
    try {
      (window as { goatcounter?: GoatCounter }).goatcounter?.count?.({ path: `game/${id}`, title: id, event: true });
    } catch {
      // Analytics must never affect the game.
    }
  };
  if ((window as { goatcounter?: GoatCounter }).goatcounter?.count) send();
  // Opened via a deep link before the async script arrived: send once it loads.
  else document.querySelector('script[data-goatcounter]')?.addEventListener('load', send, { once: true });
}
