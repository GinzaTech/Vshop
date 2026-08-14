import LoadingScreen from "~/components/LoadingScreen";

/**
 * Keeps the JavaScript loading route visually identical to the bootstrap
 * overlay so startup never flashes between different loading screens.
 */
function Index() {
  return <LoadingScreen message="Loading data..." />;
}

export default Index;
