interface JsonViewerProps {
  data: unknown;
}

export function JsonViewer({ data }: JsonViewerProps) {
  if (data === undefined || data === null) {
    return <p className="empty-copy">No data captured for this field.</p>;
  }

  return <pre className="json-viewer">{JSON.stringify(data, null, 2)}</pre>;
}
