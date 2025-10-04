import React from "react";
import ReactDOM from "react-dom";
import { Moon, Sun, Laptop } from "lucide-react";
import { useTheme } from "next-themes";

const FloatingThemeToggle: React.FC<{ right?: string; bottom?: string }> = ({
  right = "22px",
  bottom = "72px",
}) => {
  const { theme, setTheme } = useTheme();

  if (typeof document === "undefined") return null;

  const toggleTheme = () => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  };

  const getIcon = () => {
    if (theme === "light") return <Sun size={18} />;
    if (theme === "dark") return <Moon size={18} />;
    return <Laptop size={18} />; 
  };

  const button = (
    <button
      aria-label="Toggle theme"
      title={`Theme: ${theme || "system"}`}
      onClick={toggleTheme}
      style={{
        right,
        bottom,
        WebkitTapHighlightColor: "transparent",
      }}
      className="fixed z-[999999] p-3 rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-400 transition-transform transform hover:scale-105 active:scale-95 bg-slate-800/80 text-white"
    >
      {getIcon()}
    </button>
  );

  return ReactDOM.createPortal(button, document.body);
};

export default FloatingThemeToggle;
