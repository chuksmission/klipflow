// Shared by the homepage (server, inline script) and IntroPortal (client).
export const INTRO_KEY = "kf_intro_seen";

/**
 * Runs before the page paints (inline script at the top of the homepage): on
 * the first visit, without reduced motion, turn the intro on and remember it.
 */
export const INTRO_SCRIPT = `(function(){try{var k="${INTRO_KEY}";if(localStorage.getItem(k)||matchMedia("(prefers-reduced-motion: reduce)").matches)return;localStorage.setItem(k,"1");document.documentElement.classList.add("kf-intro-on");}catch(e){}})();`;
