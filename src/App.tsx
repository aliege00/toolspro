import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ThemeProvider } from "@/lib/theme";
import { LocaleProvider } from "@/i18n";
import { LibraryProvider } from "@/lib/library";
import { OutputsProvider } from "@/lib/outputs";
import { NavProvider, useNav } from "@/lib/nav";
import type { Route } from "@/lib/nav";
import Onboarding from "@/screens/Onboarding";
import Home from "@/screens/Home";
import VideoScreen from "@/screens/VideoScreen";
import FilesScreen from "@/screens/FilesScreen";
import ToolsScreen from "@/screens/ToolsScreen";
import ToolScreen from "@/screens/ToolScreen";
import Settings from "@/screens/Settings";

function renderRoute(route: Route) {
  switch (route.name) {
    case "home":
      return <Home />;
    case "video":
      return <VideoScreen fileId={route.fileId} />;
    case "files":
      return <FilesScreen />;
    case "tools":
      return <ToolsScreen />;
    case "tool":
      return <ToolScreen id={route.id} fileId={route.fileId} />;
    case "settings":
      return <Settings />;
  }
}

function routeKey(route: Route, depth: number): string {
  const id = route.name === "tool" ? route.id : "";
  const fileId = "fileId" in route ? (route.fileId ?? "") : "";
  return `${depth}:${route.name}:${id}:${fileId}`;
}

function Shell() {
  const { current, stack, direction } = useNav();

  return (
    <div className="relative h-full overflow-hidden bg-bg">
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={routeKey(current, stack.length)}
          custom={direction}
          initial={{ x: direction * 48, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: direction * -32, opacity: 0 }}
          transition={{ type: "spring", stiffness: 420, damping: 40, mass: 0.9 }}
          className="no-scrollbar absolute inset-0 overflow-y-auto"
        >
          {renderRoute(current)}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function Gate() {
  const [ready, setReady] = useState(
    () => localStorage.getItem("medya.onboarded") === "1",
  );

  if (!ready) {
    return (
      <Onboarding
        onDone={() => {
          localStorage.setItem("medya.onboarded", "1");
          setReady(true);
        }}
      />
    );
  }

  return (
    <NavProvider initial={{ name: "home" }}>
      <Shell />
    </NavProvider>
  );
}

export default function App() {
  return (
    <LocaleProvider>
      <ThemeProvider>
        <LibraryProvider>
          <OutputsProvider>
            <Gate />
          </OutputsProvider>
        </LibraryProvider>
      </ThemeProvider>
    </LocaleProvider>
  );
}
