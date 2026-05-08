import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Scrolls window and the AppLayout <main> container to top on route change.
 */
const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll the window
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    // Scroll any internal scrollable main containers
    document.querySelectorAll("main").forEach((el) => {
      el.scrollTop = 0;
    });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
