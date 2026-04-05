import * as Sentry from "@sentry/react";

Sentry.init({
    dsn: "https://4ee1fb59e49a32770ac42572523d52f8@o4511167879512064.ingest.us.sentry.io/4511167880364032",
    // Setting this option to true will send default PII data to Sentry.
    // For example, automatic IP address collection on events
    sendDefaultPii: true
});

const container = document.getElementById("app");
const root = createRoot(container);
root.render(<App />);