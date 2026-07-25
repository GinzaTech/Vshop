# React Native Flow Visualizer

Local MVP dashboard for visualizing how data moves through a React Native Android app.

## Run

```bash
npm install
npm run dev
```

For live React Native testing, run the dashboard and trace WebSocket server together:

```bash
npm run dev:live
```

Dashboard URL: `http://127.0.0.1:5173`

Trace WebSocket:

- Android emulator: `ws://10.0.2.2:8787`
- iOS simulator or web: `ws://127.0.0.1:8787`
- Physical phone: `ws://YOUR_COMPUTER_LAN_IP:8787`

## What is included

- Scenario library with Login Success, Login Failed, Generic Button Action, Fetch Profile, and Add To Cart.
- React Flow graph with highlighted active node and ordered edges.
- Timeline with search, event-type filters, status, tool source, timestamp, and duration.
- Playback controls for play, pause, step next, step back, reset, and speed.
- Event inspector with source, payload, state before and after, error, tool, and JSON detail.
- Code trace panel with highlighted snippet lines.
- Tool Integration Center covering React Native DevTools, Reactotron, Redux DevTools, Zustand middleware, Axios, AsyncStorage, React Navigation, Android Studio Network Inspector, Madge, and dependency-cruiser.
- Import FlowTrace JSON and export current trace to JSON or Markdown.
- Sensitive data masking helper for passwords, tokens, authorization, secrets, API keys, cookies, and sessions.

## Connect a React Native app

In development only, connect the tracer once near app startup:

```ts
import { flowTracer } from './path/to/flowTracer';

if (__DEV__) {
  flowTracer.connect('ws://10.0.2.2:8787');
}
```

Then wrap the flow you want to inspect:

```ts
flowTracer.startTrace('Login from Vshop');
flowTracer.track({
  type: 'UI_EVENT',
  label: 'User presses login',
  source: { file: 'LoginScreen.tsx', functionName: 'onPress' },
  input: { email, password },
});

// run real app code

flowTracer.track({
  type: 'NAVIGATION',
  label: 'Login -> Profile',
  input: { from: 'Login', to: 'Profile' },
  tool: 'React Navigation',
});
```

The dashboard receives the trace through WebSocket and adds it to the scenario list automatically.

## MVP Scope

This is local and mock-data based. It does not connect to a real React Native app, WebSocket server, native Android module, cloud sync, or AST parser yet.
