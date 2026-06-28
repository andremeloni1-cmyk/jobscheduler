import type { MetadataRoute } from "next";

// White-label the installed app name via APP_NAME in .env.
export default function manifest(): MetadataRoute.Manifest {
  const name = process.env.APP_NAME || "JoineryFlow";
  return {
    name: `${name} — Job Scheduler`,
    short_name: name,
    description: "Organise and schedule joinery jobs, with Google Calendar, Drive and Gmail automations.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#a05c26",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
